-- DIFF-PRO + DIFF-BILL stub — entitlements Pro + ledger prêt Stripe.
-- DO NOT apply without human validation (AGENTS.md).
--
-- DIFF-PRO: grant mensuel crédits boost (cap 2 mois), consume boost org,
--           early-access slots reset.
-- DIFF-BILL: ledger + apply_diffuseur_sku (mock | stripe | manual_devis).
--            Stripe Checkout / webhook = adaptateur futur sur le même RPC.

-- ---------------------------------------------------------------------------
-- Org billing / period columns
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists billing_provider text
    check (
      billing_provider is null
      or billing_provider in ('mock', 'stripe', 'manual_devis')
    ),
  add column if not exists billing_external_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists boost_credits_period_ym text,
  add column if not exists highlight_credits_balance integer not null default 0
    check (highlight_credits_balance >= 0);

comment on column public.organizations.boost_credits_period_ym is
  'YYYY-MM of last Pro monthly boost grant (Europe/Paris).';
comment on column public.organizations.billing_external_id is
  'Stripe subscription/customer id or devis reference when wired.';

-- ---------------------------------------------------------------------------
-- Billing ledger (abo + packs + consumes)
-- ---------------------------------------------------------------------------
create table if not exists public.diffuseur_billing_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sku text not null,
  provider text not null
    check (provider in ('mock', 'stripe', 'manual_devis', 'system')),
  external_id text,
  amount_cents_ht integer,
  currency text not null default 'eur',
  status text not null default 'applied'
    check (status in ('pending', 'applied', 'failed', 'refunded')),
  effects jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists diffuseur_billing_ledger_provider_external_uidx
  on public.diffuseur_billing_ledger (provider, external_id)
  where external_id is not null;

create index if not exists diffuseur_billing_ledger_org_created_idx
  on public.diffuseur_billing_ledger (organization_id, created_at desc);

comment on table public.diffuseur_billing_ledger is
  'DIFF-BILL: Diffuseur abo/packs ledger. Stripe webhook writes same rows as mock.';

alter table public.diffuseur_billing_ledger enable row level security;

drop policy if exists diffuseur_billing_ledger_select_member on public.diffuseur_billing_ledger;
create policy diffuseur_billing_ledger_select_member on public.diffuseur_billing_ledger
  for select to authenticated
  using (public.is_organization_member(organization_id));

grant select on public.diffuseur_billing_ledger to authenticated;
grant all on public.diffuseur_billing_ledger to service_role;

-- ---------------------------------------------------------------------------
-- DIFF-PRO: monthly boost credit grant (cap = 4 = 2 mois × 2)
-- ---------------------------------------------------------------------------
create or replace function public.grant_diffuseur_monthly_boost_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_ym text := to_char((now() at time zone 'Europe/Paris'), 'YYYY-MM');
  v_updated integer := 0;
  r record;
begin
  for r in
    select id, boost_credits_balance
    from public.organizations
    where diffuseur_plan = 'pro'
      and coalesce(boost_credits_period_ym, '') is distinct from v_ym
  loop
    update public.organizations
    set
      boost_credits_balance = least(coalesce(boost_credits_balance, 0) + 2, 4),
      early_access_slots_monthly = 2,
      boost_credits_period_ym = v_ym,
      updated_at = now()
    where id = r.id;

    insert into public.diffuseur_billing_ledger (
      organization_id, sku, provider, status, effects, metadata
    ) values (
      r.id,
      'grant_monthly_boost',
      'system',
      'applied',
      jsonb_build_object(
        'boost_credits_added', 2,
        'boost_credits_cap', 4,
        'period_ym', v_ym
      ),
      jsonb_build_object('source', 'grant_diffuseur_monthly_boost_credits')
    );

    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$func$;

comment on function public.grant_diffuseur_monthly_boost_credits() is
  'DIFF-PRO: +2 boost credits / month for Pro orgs; balance capped at 4.';

revoke all on function public.grant_diffuseur_monthly_boost_credits() from public, anon, authenticated;
grant execute on function public.grant_diffuseur_monthly_boost_credits() to service_role;

-- Cron (idempotent reschedule)
create extension if not exists pg_cron;

do $cron$
begin
  perform cron.unschedule('diffuseur-monthly-boost-credits');
exception
  when others then null;
end;
$cron$;

select cron.schedule(
  'diffuseur-monthly-boost-credits',
  '15 4 1 * *',
  $$select public.grant_diffuseur_monthly_boost_credits();$$
);

-- ---------------------------------------------------------------------------
-- DIFF-PRO: consume 1 org boost credit → event boosted_until +24h
-- ---------------------------------------------------------------------------
create or replace function public.consume_diffuseur_boost_credit(
  p_organization_id uuid,
  p_event_id uuid,
  p_hours integer default 24
)
returns json
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_uid uuid := auth.uid();
  v_bal integer;
  v_creator uuid;
  v_expires timestamptz;
  v_hours integer := greatest(coalesce(p_hours, 24), 1);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not public.is_organization_member(p_organization_id) then
    raise exception 'NOT_ORG_MEMBER';
  end if;

  select creator_id into v_creator from public.events where id = p_event_id;
  if v_creator is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  -- Creator must be member of the org (owner path included via membership backfill)
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = v_creator
  ) and not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.owner_id = v_creator
  ) then
    raise exception 'EVENT_NOT_IN_ORG';
  end if;

  select boost_credits_balance into v_bal
  from public.organizations
  where id = p_organization_id
  for update;

  if v_bal is null then
    raise exception 'ORG_NOT_FOUND';
  end if;
  if v_bal < 1 then
    raise exception 'NO_BOOST_CREDITS';
  end if;

  update public.organizations
  set boost_credits_balance = v_bal - 1, updated_at = now()
  where id = p_organization_id;

  v_expires := now() + make_interval(hours => v_hours);

  update public.events
  set boosted_until = greatest(coalesce(boosted_until, now()), v_expires)
  where id = p_event_id;

  insert into public.diffuseur_billing_ledger (
    organization_id, sku, provider, status, effects, metadata, created_by
  ) values (
    p_organization_id,
    'consume_boost',
    'system',
    'applied',
    jsonb_build_object(
      'event_id', p_event_id,
      'hours', v_hours,
      'expires_at', v_expires
    ),
    jsonb_build_object('source', 'consume_diffuseur_boost_credit'),
    v_uid
  );

  return json_build_object(
    'success', true,
    'event_id', p_event_id,
    'expires_at', v_expires,
    'boost_credits_remaining', v_bal - 1
  );
end;
$func$;

revoke all on function public.consume_diffuseur_boost_credit(uuid, uuid, integer) from public, anon;
grant execute on function public.consume_diffuseur_boost_credit(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- DIFF-BILL: apply SKU (mock today, Stripe webhook tomorrow)
-- ---------------------------------------------------------------------------
create or replace function public.apply_diffuseur_sku(
  p_organization_id uuid,
  p_sku text,
  p_provider text default 'mock',
  p_external_id text default null,
  p_amount_cents_ht integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := coalesce(auth.role() = 'service_role', false);
  v_effects jsonb := '{}'::jsonb;
  v_period_end timestamptz;
  v_seat integer;
  v_ym text := to_char((now() at time zone 'Europe/Paris'), 'YYYY-MM');
begin
  if p_sku is null or length(trim(p_sku)) = 0 then
    raise exception 'SKU_REQUIRED';
  end if;

  if p_provider not in ('mock', 'stripe', 'manual_devis') then
    raise exception 'INVALID_PROVIDER';
  end if;

  -- Authz: mock = org admin; stripe/devis = service_role only
  if p_provider = 'mock' then
    if v_uid is null or not public.is_organization_admin(p_organization_id) then
      raise exception 'MOCK_ADMIN_ONLY';
    end if;
  elsif not v_is_service then
    raise exception 'PROVIDER_SERVICE_ROLE_ONLY';
  end if;

  -- Idempotency when external_id present
  if p_external_id is not null and exists (
    select 1 from public.diffuseur_billing_ledger
    where provider = p_provider and external_id = p_external_id and status = 'applied'
  ) then
    return json_build_object('success', true, 'idempotent', true, 'external_id', p_external_id);
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORG_NOT_FOUND';
  end if;

  case p_sku
    when 'diffuseur_pro_monthly' then
      v_period_end := now() + interval '1 month';
      update public.organizations set
        diffuseur_plan = 'pro',
        seat_limit = greatest(seat_limit, 5),
        early_access_slots_monthly = greatest(early_access_slots_monthly, 2),
        billing_provider = p_provider,
        billing_external_id = coalesce(p_external_id, billing_external_id),
        current_period_end = v_period_end,
        boost_credits_balance = case
          when coalesce(boost_credits_period_ym, '') is distinct from v_ym
            then least(coalesce(boost_credits_balance, 0) + 2, 4)
          else boost_credits_balance
        end,
        boost_credits_period_ym = v_ym,
        updated_at = now()
      where id = p_organization_id;
      v_effects := jsonb_build_object(
        'plan', 'pro',
        'period', 'monthly',
        'current_period_end', v_period_end,
        'boost_credits_granted_if_new_period', 2
      );

    when 'diffuseur_pro_annual' then
      v_period_end := now() + interval '1 year';
      update public.organizations set
        diffuseur_plan = 'pro',
        seat_limit = greatest(seat_limit, 5),
        early_access_slots_monthly = greatest(early_access_slots_monthly, 2),
        billing_provider = p_provider,
        billing_external_id = coalesce(p_external_id, billing_external_id),
        current_period_end = v_period_end,
        boost_credits_balance = case
          when coalesce(boost_credits_period_ym, '') is distinct from v_ym
            then least(coalesce(boost_credits_balance, 0) + 2, 4)
          else boost_credits_balance
        end,
        boost_credits_period_ym = v_ym,
        updated_at = now()
      where id = p_organization_id;
      v_effects := jsonb_build_object(
        'plan', 'pro',
        'period', 'annual',
        'current_period_end', v_period_end
      );

    when 'diffuseur_free' then
      update public.organizations set
        diffuseur_plan = 'free',
        seat_limit = 1,
        early_access_slots_monthly = 0,
        billing_provider = p_provider,
        current_period_end = null,
        updated_at = now()
      where id = p_organization_id;
      v_effects := jsonb_build_object('plan', 'free');

    when 'pack_boost_express' then
      update public.organizations set
        boost_credits_balance = coalesce(boost_credits_balance, 0) + 1,
        updated_at = now()
      where id = p_organization_id;
      v_effects := jsonb_build_object('boost_credits_added', 1, 'hours', 24);

    when 'pack_weekend_fort' then
      update public.organizations set
        boost_credits_balance = coalesce(boost_credits_balance, 0) + 1,
        highlight_credits_balance = coalesce(highlight_credits_balance, 0) + 1,
        updated_at = now()
      where id = p_organization_id;
      v_effects := jsonb_build_object(
        'boost_credits_added', 1,
        'boost_hours', 72,
        'highlight_credits_added', 1,
        'highlight_days', 7
      );

    when 'pack_campagne_quartier' then
      update public.organizations set
        boost_credits_balance = coalesce(boost_credits_balance, 0) + 3,
        highlight_credits_balance = coalesce(highlight_credits_balance, 0) + 1,
        updated_at = now()
      where id = p_organization_id;
      v_effects := jsonb_build_object(
        'boost_credits_added', 3,
        'highlight_credits_added', 1,
        'pin_map_days', 7
      );

    when 'pack_siege_extra' then
      if (select diffuseur_plan from public.organizations where id = p_organization_id) <> 'pro' then
        raise exception 'PACK_PRO_ONLY';
      end if;
      update public.organizations set
        seat_limit = least(coalesce(seat_limit, 5) + 1, 50),
        updated_at = now()
      where id = p_organization_id
      returning seat_limit into v_seat;
      v_effects := jsonb_build_object('seat_limit_delta', 1, 'seat_limit', v_seat);

    else
      raise exception 'UNKNOWN_SKU (%)', p_sku;
  end case;

  insert into public.diffuseur_billing_ledger (
    organization_id, sku, provider, external_id, amount_cents_ht,
    status, effects, metadata, created_by
  ) values (
    p_organization_id,
    p_sku,
    p_provider,
    p_external_id,
    p_amount_cents_ht,
    'applied',
    v_effects,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', 'apply_diffuseur_sku'),
    v_uid
  );

  return json_build_object(
    'success', true,
    'sku', p_sku,
    'provider', p_provider,
    'effects', v_effects
  );
end;
$func$;

comment on function public.apply_diffuseur_sku(uuid, text, text, text, integer, jsonb) is
  'DIFF-BILL stub: mock admin apply OR service_role (Stripe/devis) → same entitlements path.';

revoke all on function public.apply_diffuseur_sku(uuid, text, text, text, integer, jsonb) from public, anon;
grant execute on function public.apply_diffuseur_sku(uuid, text, text, text, integer, jsonb) to authenticated, service_role;
