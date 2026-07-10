-- DISC-P0-001 diagnostics: verify discovery domain schema after migration apply.
-- Non-destructive read-only checks.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
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
ORDER BY table_name;

SELECT typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND typname IN (
    'discovery_place_type',
    'discovery_visit_source',
    'discovery_transport_mode',
    'recommendation_type',
    'recommendation_event_type',
    'discovery_insight_type',
    'subscription_status',
    'subscription_provider'
  )
ORDER BY typname;

-- GiST index on discovery_places.location
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'discovery_places'
  AND indexdef ILIKE '%gist%';

-- FK: discovery_visits.recommendation_id -> event_recommendations
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.discovery_visits'::regclass
  AND conname = 'discovery_visits_recommendation_id_fkey';
