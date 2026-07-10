-- DISC-P0-011 diagnostics: verify profile recalculation job exists.
-- Non-destructive read-only checks.

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'discovery_recalculate_profiles';

SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'discovery-recalculate-profiles';

-- Manual smoke (service_role only for batch):
-- SELECT public.discovery_recalculate_profiles('<user_uuid_with_consent>');
