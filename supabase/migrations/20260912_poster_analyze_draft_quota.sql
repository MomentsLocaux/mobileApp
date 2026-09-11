-- Poster IA: 2 analyses par brouillon + consommation mensuelle atomique (event_suggest_usage).
-- Empêche de relancer 100 fois la même affiche pour une seule suggestion.
--
-- Human validation required before apply on DEV/UAT. Do not apply automatically.

-- ---------------------------------------------------------------------------
-- Per-draft poster analysis quota (2 tries / draft_id)
-- ---------------------------------------------------------------------------
create table if not exists public.event_poster_analyze_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_id uuid not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_id)
);

alter table public.event_poster_analyze_usage enable row level security;

comment on table public.event_poster_analyze_usage is
  'AI poster analyses per user draft (default limit 2). Written by Edge Function suggest-event-from-poster only.';

create or replace function public.consume_event_poster_analyze_quota(
  p_user_id uuid,
  p_draft_id uuid,
  p_limit integer default 2
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_draft_id is null or coalesce(p_limit, 0) < 1 then
    return false;
  end if;

  insert into public.event_poster_analyze_usage (user_id, draft_id, request_count, updated_at)
  values (p_user_id, p_draft_id, 1, now())
  on conflict (user_id, draft_id)
  do update
    set request_count = public.event_poster_analyze_usage.request_count + 1,
        updated_at = now()
    where public.event_poster_analyze_usage.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

create or replace function public.release_event_poster_analyze_quota(
  p_user_id uuid,
  p_draft_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_poster_analyze_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and draft_id = p_draft_id
    and request_count > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic monthly poster quota (same table as SCRUM-106)
-- ---------------------------------------------------------------------------
create or replace function public.consume_event_suggest_monthly_quota(
  p_user_id uuid,
  p_limit integer default 20
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
begin
  if p_user_id is null or coalesce(p_limit, 0) < 1 then
    return false;
  end if;

  insert into public.event_suggest_usage (user_id, period_ym, request_count, updated_at)
  values (p_user_id, v_period, 1, now())
  on conflict (user_id, period_ym)
  do update
    set request_count = public.event_suggest_usage.request_count + 1,
        updated_at = now()
    where public.event_suggest_usage.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

create or replace function public.release_event_suggest_monthly_quota(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
begin
  update public.event_suggest_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and period_ym = v_period
    and request_count > 0;
end;
$$;

revoke all on function public.consume_event_poster_analyze_quota(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_event_poster_analyze_quota(uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_event_suggest_monthly_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_event_suggest_monthly_quota(uuid) from public, anon, authenticated;

grant execute on function public.consume_event_poster_analyze_quota(uuid, uuid, integer) to service_role;
grant execute on function public.release_event_poster_analyze_quota(uuid, uuid) to service_role;
grant execute on function public.consume_event_suggest_monthly_quota(uuid, integer) to service_role;
grant execute on function public.release_event_suggest_monthly_quota(uuid) to service_role;
