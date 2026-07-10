-- DISC-P0-002 diagnostics: discovery RLS and RPC smoke checks (read-only).

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_subscriptions',
    'discovery_consents',
    'discovery_places',
    'discovery_visits',
    'mobility_profiles',
    'discovery_profiles',
    'discovery_insights',
    'event_recommendations',
    'recommendation_events',
    'discovery_daily_summaries',
    'discovery_location_batches'
  )
ORDER BY tablename;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'discovery_%'
   OR tablename IN ('user_subscriptions', 'event_recommendations', 'recommendation_events')
ORDER BY tablename, policyname;

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_user_entitlement',
    'upsert_discovery_consent',
    'track_recommendation_event',
    'get_active_recommendations',
    'mark_discovery_insight_seen',
    'purge_discovery_data'
  )
ORDER BY routine_name;
