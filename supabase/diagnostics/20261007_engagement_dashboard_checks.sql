-- SCRUM-306 read-only checks.
-- Run as service_role after a human applies 20261007110845_eng_h1_analytics_events.sql.
-- This file does not mutate data. Empty results are expected until the app emits events.

select to_regclass('analytics.events') as events_table;

select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in ('track_analytics_events', 'purge_analytics_events'))
   or (n.nspname = 'analytics' and p.proname = 'purge_expired_events')
order by n.nspname, p.proname;

select
  t.tgname as trigger_name,
  p.proname as function_name,
  t.tgenabled as enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and c.relname = 'account_deletion_requests'
  and t.tgname = 'trg_purge_analytics_on_deletion';

select * from analytics.retention_cohorts;
select * from analytics.stickiness_weekly;
select * from analytics.sessions_per_user_weekly;
select * from analytics.home_tap_rate;
select * from analytics.home_reason_coverage;
select * from analytics.favorite_per_impression;
select * from analytics.dismiss_rate;
select * from analytics.push_optin_rate;
select * from analytics.push_ctr_by_type;
select * from analytics.post_event_feedback_rate;
