-- DISC-P0-003 diagnostics: verify discovery notification preference columns.
-- Non-destructive read-only checks.

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_preferences'
  AND column_name IN (
    'discovery_push_enabled',
    'right_now_push_enabled',
    'break_loop_push_enabled',
    'life_insight_push_enabled',
    'discovery_max_push_per_week'
  )
ORDER BY column_name;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.user_preferences'::regclass
  AND conname LIKE '%discovery_max_push%';
