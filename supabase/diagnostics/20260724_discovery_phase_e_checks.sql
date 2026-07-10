-- DISC-P1 Phase E diagnostics (read-only).

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'discovery_match_outcomes',
    'discovery_generate_insights',
    'get_active_insights',
    'discovery_enqueue_right_now_pushes',
    'log_activity'
  );

SELECT jobid, jobname, schedule
FROM cron.job
WHERE jobname IN (
  'discovery-match-outcomes',
  'discovery-generate-insights',
  'discovery-push-opportunities'
);

-- Manual smoke (service_role):
-- SELECT public.discovery_match_outcomes();
-- SELECT public.discovery_generate_insights();
