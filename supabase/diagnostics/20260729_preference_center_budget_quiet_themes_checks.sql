-- PREF-P0-001 diagnostics: verify preference center columns on user_preferences.
-- Non-destructive read-only checks. Run after migration apply on the target env.

SELECT column_name, data_type, column_default, is_nullable, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_preferences'
  AND column_name IN (
    'max_push_per_day',
    'quiet_hours_start',
    'quiet_hours_end',
    'preferred_category_slugs'
  )
ORDER BY column_name;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.user_preferences'::regclass
  AND (
    conname LIKE '%max_push_per_day%'
    OR pg_get_constraintdef(oid) ILIKE '%max_push_per_day%'
  );

SELECT
  col_description('public.user_preferences'::regclass, a.attnum) AS comment,
  a.attname AS column_name
FROM pg_attribute a
WHERE a.attrelid = 'public.user_preferences'::regclass
  AND a.attname IN (
    'max_push_per_day',
    'quiet_hours_start',
    'quiet_hours_end',
    'preferred_category_slugs'
  )
  AND NOT a.attisdropped
ORDER BY a.attname;
