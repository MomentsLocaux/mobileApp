-- SCRUM-299 + SCRUM-306. Additive. Do not apply without human validation.
-- Product events only. No names, emails, message bodies, or tokens.
-- Views live in schema analytics and are readable by service_role (SQL editor / console), not by the app.

begin;

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;
grant usage on schema analytics to service_role;

create table if not exists analytics.events (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null,
  user_id uuid,
  session_id uuid not null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_client_event_id_key unique (client_event_id),
  constraint analytics_events_props_size check (octet_length(props::text) <= 2048)
);

comment on table analytics.events is
  'SCRUM-299 product events. user_id is auth.uid() (pseudonymous). props are allow-listed codes, never free text.';

create index if not exists analytics_events_name_created_idx
  on analytics.events (name, created_at desc);
create index if not exists analytics_events_user_created_idx
  on analytics.events (user_id, created_at desc);

alter table analytics.events enable row level security;
revoke all on analytics.events from public, anon, authenticated;
grant select on analytics.events to service_role;

alter table public.user_preferences
  add column if not exists analytics_opt_out boolean not null default false;

comment on column public.user_preferences.analytics_opt_out is
  'SCRUM-299. When true, track_analytics_events stores nothing for this account.';

create or replace function public.track_analytics_events(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = analytics, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_name text;
  v_props jsonb;
  v_client uuid;
  v_session uuid;
  v_inserted integer := 0;
  v_seen integer := 0;
  v_wrote integer := 0;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'events array required';
  end if;

  if v_uid is not null and exists (
    select 1
    from public.user_preferences up
    where up.user_id = v_uid
      and up.analytics_opt_out is true
  ) then
    return 0;
  end if;

  for v_row in select value from jsonb_array_elements(p_events)
  loop
    v_seen := v_seen + 1;
    exit when v_seen > 50;

    v_name := v_row->>'name';
    if v_name is null or v_name not in (
      'app_opened',
      'home_viewed',
      'home_card_tapped',
      'home_card_dismissed',
      'event_viewed',
      'event_favorited',
      'search_performed',
      'notification_received',
      'notification_opened',
      'push_permission_result',
      'onboarding_completed',
      'session_end'
    ) then
      continue;
    end if;

    if v_row ? 'props' and (
      (v_row->'props') ?| array['email', 'display_name', 'name', 'token', 'body', 'phone', 'message']
    ) then
      continue;
    end if;

    begin
      v_client := (v_row->>'client_event_id')::uuid;
      v_session := (v_row->>'session_id')::uuid;
    exception
      when invalid_text_representation then
        continue;
    end;

    v_props := coalesce(v_row->'props', '{}'::jsonb);
    if jsonb_typeof(v_props) <> 'object' or octet_length(v_props::text) > 2048 then
      continue;
    end if;

    insert into analytics.events (client_event_id, user_id, session_id, name, props)
    values (v_client, v_uid, v_session, v_name, v_props)
    on conflict (client_event_id) do nothing;

    get diagnostics v_wrote = row_count;
    v_inserted := v_inserted + v_wrote;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.track_analytics_events(jsonb) from public, anon;
grant execute on function public.track_analytics_events(jsonb) to authenticated;

comment on function public.track_analytics_events(jsonb) is
  'SCRUM-299. Inserts allow-listed events for auth.uid(). Unknown names and nominative prop keys are skipped. client_event_id is idempotent.';

create or replace function public.purge_analytics_events(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  delete from analytics.events where user_id = p_user_id;
end;
$$;

revoke all on function public.purge_analytics_events(uuid) from public, anon, authenticated;
grant execute on function public.purge_analytics_events(uuid) to service_role;

create or replace function public.purge_analytics_on_deletion_request()
returns trigger
language plpgsql
security definer
set search_path = analytics, public
as $$
begin
  perform public.purge_analytics_events(new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_purge_analytics_on_deletion on public.account_deletion_requests;
create trigger trg_purge_analytics_on_deletion
  after insert on public.account_deletion_requests
  for each row
  execute function public.purge_analytics_on_deletion_request();

revoke all on function public.purge_analytics_on_deletion_request() from public, anon, authenticated;
grant execute on function public.purge_analytics_on_deletion_request() to service_role;

comment on function public.purge_analytics_on_deletion_request() is
  'SCRUM-299. process_account_deletion inserts account_deletion_requests; this trigger purges analytics for that user.';

create or replace function analytics.purge_expired_events()
returns integer
language plpgsql
security definer
set search_path = analytics, public
as $$
declare
  v_deleted integer := 0;
begin
  delete from analytics.events
  where created_at < now() - interval '13 months';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function analytics.purge_expired_events() from public, anon, authenticated;
grant execute on function analytics.purge_expired_events() to service_role;

comment on function analytics.purge_expired_events() is
  'SCRUM-299 retention: deletes product events older than 13 months.';

-- SCRUM-306. Each view is one indicator. Window is the last 12 weeks unless noted.

-- D1 / D7 / D30: an app_opened on calendar day N after signup (Europe/Paris), by signup week.
create or replace view analytics.retention_cohorts as
with signups as (
  select
    id as user_id,
    created_at as signed_up_at,
    date_trunc('week', created_at at time zone 'Europe/Paris') as cohort_week
  from public.profiles
  where created_at >= now() - interval '12 weeks'
),
opens as (
  select user_id, (created_at at time zone 'Europe/Paris')::date as opened_on
  from analytics.events
  where name = 'app_opened'
    and user_id is not null
)
select
  s.cohort_week,
  count(*)::integer as signups,
  count(*) filter (
    where exists (
      select 1 from opens o
      where o.user_id = s.user_id
        and o.opened_on = (s.signed_up_at at time zone 'Europe/Paris')::date + 1
    )
  )::integer as retained_d1,
  count(*) filter (
    where exists (
      select 1 from opens o
      where o.user_id = s.user_id
        and o.opened_on = (s.signed_up_at at time zone 'Europe/Paris')::date + 7
    )
  )::integer as retained_d7,
  count(*) filter (
    where exists (
      select 1 from opens o
      where o.user_id = s.user_id
        and o.opened_on = (s.signed_up_at at time zone 'Europe/Paris')::date + 30
    )
  )::integer as retained_d30
from signups s
group by s.cohort_week;

comment on view analytics.retention_cohorts is
  'SCRUM-306. Weekly signup cohort. retained_dN = opened the app on calendar day N after signup (Europe/Paris).';

-- WAU / MAU from distinct accounts with app_opened. Single current window, not a weekly series.
create or replace view analytics.stickiness_weekly as
select
  count(distinct user_id) filter (where created_at >= now() - interval '7 days')::integer as wau,
  count(distinct user_id) filter (where created_at >= now() - interval '30 days')::integer as mau,
  case
    when count(distinct user_id) filter (where created_at >= now() - interval '30 days') = 0 then 0
    else count(distinct user_id) filter (where created_at >= now() - interval '7 days')::numeric
      / count(distinct user_id) filter (where created_at >= now() - interval '30 days')
  end as stickiness
from analytics.events
where name = 'app_opened'
  and user_id is not null
  and created_at >= now() - interval '30 days';

comment on view analytics.stickiness_weekly is
  'SCRUM-306. stickiness = WAU / MAU, distinct user_id with app_opened.';

-- Median number of session_end events per user, per ISO week.
create or replace view analytics.sessions_per_user_weekly as
with per_user as (
  select
    date_trunc('week', created_at at time zone 'Europe/Paris') as week,
    user_id,
    count(*)::integer as sessions
  from analytics.events
  where name = 'session_end'
    and user_id is not null
    and created_at >= now() - interval '12 weeks'
  group by 1, 2
)
select
  week,
  percentile_cont(0.5) within group (order by sessions) as median_sessions
from per_user
group by week;

comment on view analytics.sessions_per_user_weekly is
  'SCRUM-306. Median session_end count per user per week (Europe/Paris).';

-- Sessions with a home card tap, among sessions that viewed home.
create or replace view analytics.home_tap_rate as
with sessions as (
  select
    session_id,
    bool_or(name = 'home_viewed') as viewed,
    bool_or(name = 'home_card_tapped') as tapped
  from analytics.events
  where name in ('home_viewed', 'home_card_tapped')
    and created_at >= now() - interval '12 weeks'
  group by session_id
)
select
  count(*) filter (where viewed)::integer as home_sessions,
  count(*) filter (where viewed and tapped)::integer as tapped_sessions,
  case
    when count(*) filter (where viewed) = 0 then 0
    else count(*) filter (where viewed and tapped)::numeric / count(*) filter (where viewed)
  end as tap_rate
from sessions;

comment on view analytics.home_tap_rate is
  'SCRUM-306. tap_rate = sessions with home_card_tapped / sessions with home_viewed, last 12 weeks.';

-- Share of home cards that carried a motif code.
create or replace view analytics.home_reason_coverage as
select
  coalesce(sum((props->>'card_count')::numeric), 0) as cards,
  coalesce(sum((props->>'cards_with_reason')::numeric), 0) as cards_with_reason,
  case
    when coalesce(sum((props->>'card_count')::numeric), 0) = 0 then 0
    else sum((props->>'cards_with_reason')::numeric) / sum((props->>'card_count')::numeric)
  end as coverage
from analytics.events
where name = 'home_viewed'
  and created_at >= now() - interval '12 weeks';

comment on view analytics.home_reason_coverage is
  'SCRUM-306. cards_with_reason / card_count on home_viewed, last 12 weeks.';

create or replace view analytics.favorite_per_impression as
select
  count(*) filter (where name = 'event_favorited')::integer as favorites,
  coalesce(sum((props->>'card_count')::numeric) filter (where name = 'home_viewed'), 0) as impressions,
  case
    when coalesce(sum((props->>'card_count')::numeric) filter (where name = 'home_viewed'), 0) = 0 then 0
    else count(*) filter (where name = 'event_favorited')::numeric
      / sum((props->>'card_count')::numeric) filter (where name = 'home_viewed')
  end as rate
from analytics.events
where name in ('event_favorited', 'home_viewed')
  and created_at >= now() - interval '12 weeks';

comment on view analytics.favorite_per_impression is
  'SCRUM-306. event_favorited count / sum of home_viewed card_count, last 12 weeks.';

create or replace view analytics.dismiss_rate as
select
  count(*) filter (where name = 'home_card_dismissed')::integer as dismissed,
  count(*) filter (where name = 'home_viewed')::integer as home_views,
  case
    when count(*) filter (where name = 'home_viewed') = 0 then 0
    else count(*) filter (where name = 'home_card_dismissed')::numeric
      / count(*) filter (where name = 'home_viewed')
  end as rate
from analytics.events
where name in ('home_card_dismissed', 'home_viewed')
  and created_at >= now() - interval '12 weeks';

comment on view analytics.dismiss_rate is
  'SCRUM-306. home_card_dismissed / home_viewed. Dismiss has no home gesture yet, so the rate stays 0 until that event is emitted.';

-- Active push tokens over profiles. Not an analytics_events measure.
create or replace view analytics.push_optin_rate as
select
  (select count(distinct user_id) from public.device_push_tokens)::integer as users_with_token,
  (select count(*) from public.profiles)::integer as profiles,
  case
    when (select count(*) from public.profiles) = 0 then 0
    else (select count(distinct user_id) from public.device_push_tokens)::numeric
      / (select count(*) from public.profiles)
  end as optin_rate;

comment on view analytics.push_optin_rate is
  'SCRUM-306. Distinct device_push_tokens.user_id / profiles.';

-- CTR under 5% is flagged for a glance in the console.
create or replace view analytics.push_ctr_by_type as
with counts as (
  select
    coalesce(props->>'type', 'unknown') as push_type,
    count(*) filter (where name = 'notification_received')::integer as received,
    count(*) filter (where name = 'notification_opened')::integer as opened
  from analytics.events
  where name in ('notification_received', 'notification_opened')
    and created_at >= now() - interval '12 weeks'
  group by 1
)
select
  push_type,
  received,
  opened,
  case when received = 0 then 0 else opened::numeric / received end as ctr,
  (received > 0 and opened::numeric / received < 0.05) as below_threshold
from counts;

comment on view analytics.push_ctr_by_type is
  'SCRUM-306. opened / received by notification type. below_threshold is true when CTR is under 5%.';

-- SCRUM-69 is not instrumented. The indicator exists so the dashboard has a row.
create or replace view analytics.post_event_feedback_rate as
select
  0::integer as feedback_events,
  0::integer as completed_events,
  null::numeric as rate;

comment on view analytics.post_event_feedback_rate is
  'SCRUM-306 placeholder. Numerator arrives with SCRUM-69 (feedback J+1). rate stays null until then.';

revoke all on all tables in schema analytics from public, anon, authenticated;
grant select on all tables in schema analytics to service_role;

commit;
