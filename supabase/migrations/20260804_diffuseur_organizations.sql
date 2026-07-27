-- DIFF-ORG / ADR_006 — organizations + seats for Moments Diffuseur.
-- DO NOT apply without human validation (AGENTS.md).
--
-- Model (V1):
--   one organization per professionnel owner
--   Free seat_limit = 1 ; Pro seat_limit = 5
--   No publication quotas (aligned B2C)
--
-- Depends on: profiles.pro_subtype, profiles.can_create (20260802_account_identity_adr007)

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  pro_subtype text
    check (
      pro_subtype is null
      or pro_subtype in (
        'independant',
        'association',
        'lieu',
        'office_tourisme',
        'collectivite'
      )
    ),
  diffuseur_plan text not null default 'free'
    check (diffuseur_plan in ('free', 'pro')),
  seat_limit integer not null default 1
    check (seat_limit >= 1 and seat_limit <= 50),
  verified_at timestamptz,
  boost_credits_balance integer not null default 0
    check (boost_credits_balance >= 0),
  early_access_slots_monthly integer not null default 0
    check (early_access_slots_monthly >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_owner_unique unique (owner_id)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null
    check (member_role in ('admin', 'editor')),
  created_at timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists organizations_plan_idx
  on public.organizations (diffuseur_plan);

comment on table public.organizations is
  'ADR_006 Moments Diffuseur org account (Free/Pro). One org per owner in V1.';
comment on table public.organization_members is
  'Org seats: admin/editor. Count must stay <= organizations.seat_limit.';

-- Seat enforcement
create or replace function public.enforce_organization_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  lim integer;
  cnt integer;
begin
  select seat_limit into lim
  from public.organizations
  where id = new.organization_id;

  if lim is null then
    raise exception 'Organization introuvable.';
  end if;

  select count(*)::integer into cnt
  from public.organization_members
  where organization_id = new.organization_id;

  -- INSERT counts current rows before this insert is visible → allow cnt < lim
  if tg_op = 'INSERT' and cnt >= lim then
    raise exception 'Limite de sièges atteinte (%). Passez Diffuseur Pro ou ajoutez un siège.', lim;
  end if;

  return new;
end;
$func$;

drop trigger if exists trg_organization_seat_limit on public.organization_members;
create trigger trg_organization_seat_limit
  before insert on public.organization_members
  for each row execute function public.enforce_organization_seat_limit();

-- Keep seat_limit aligned with plan on update
create or replace function public.sync_organization_seat_limit_from_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if new.diffuseur_plan = 'pro' then
    if new.seat_limit < 5 then
      new.seat_limit := 5;
    end if;
    if new.early_access_slots_monthly < 2 then
      new.early_access_slots_monthly := 2;
    end if;
  elsif new.diffuseur_plan = 'free' then
    new.seat_limit := 1;
    new.early_access_slots_monthly := 0;
  end if;
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists trg_organizations_plan_seats on public.organizations;
create trigger trg_organizations_plan_seats
  before insert or update of diffuseur_plan, seat_limit
  on public.organizations
  for each row execute function public.sync_organization_seat_limit_from_plan();

-- Backfill: one Free org per professionnel (post-institutionnel remap preferred)
insert into public.organizations (owner_id, name, pro_subtype, diffuseur_plan, seat_limit)
select
  p.id,
  coalesce(nullif(trim(p.display_name), ''), 'Mon organisation'),
  p.pro_subtype,
  'free',
  1
from public.profiles p
where p.role::text = 'professionnel'
  and not exists (
    select 1 from public.organizations o where o.owner_id = p.id
  );

insert into public.organization_members (organization_id, user_id, member_role)
select o.id, o.owner_id, 'admin'
from public.organizations o
where not exists (
  select 1
  from public.organization_members m
  where m.organization_id = o.id and m.user_id = o.owner_id
);

-- RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create or replace function public.is_organization_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.member_role = 'admin'
  );
$$;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.is_organization_member(id) or owner_id = auth.uid());

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.is_organization_admin(id) or owner_id = auth.uid())
  with check (public.is_organization_admin(id) or owner_id = auth.uid());

drop policy if exists organizations_insert_owner on public.organizations;
create policy organizations_insert_owner on public.organizations
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists organization_members_insert_admin on public.organization_members;
create policy organization_members_insert_admin on public.organization_members
  for insert to authenticated
  with check (
    public.is_organization_admin(organization_id)
    or exists (
      select 1 from public.organizations o
      where o.id = organization_id and o.owner_id = auth.uid()
    )
  );

drop policy if exists organization_members_delete_admin on public.organization_members;
create policy organization_members_delete_admin on public.organization_members
  for delete to authenticated
  using (
    public.is_organization_admin(organization_id)
    and user_id is distinct from (
      select owner_id from public.organizations where id = organization_id
    )
  );

grant select, insert, update on public.organizations to authenticated;
grant select, insert, delete on public.organization_members to authenticated;
