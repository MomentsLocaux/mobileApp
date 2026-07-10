-- DISC-P0-006 diagnostics: verify discovery scoring RPCs exist.
-- Non-destructive read-only checks.

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_discovery_engagement_affinities',
    'get_discovery_scoring_candidates',
    'get_home_location_coords'
  )
ORDER BY routine_name;

-- Smoke: function signatures (no execution without coordinates)
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_discovery_engagement_affinities',
    'get_discovery_scoring_candidates',
    'get_home_location_coords'
  )
ORDER BY p.proname;
