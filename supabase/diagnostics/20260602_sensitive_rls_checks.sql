-- MVP-P0-003 read-only diagnostics.
-- Run after applying 20260602_tighten_sensitive_rls.sql in staging.
-- This file does not mutate data or policies.

-- 1. Inspect active policies on sensitive tables.
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'event_checkins',
    'bug_reports',
    'event_views',
    'event_likes',
    'reports',
    'notifications',
    'favorites',
    'follows'
  )
ORDER BY tablename, policyname;

-- 2. Flag direct anon SELECT policies that should not exist.
SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'event_checkins',
    'bug_reports',
    'event_views',
    'event_likes',
    'reports',
    'notifications',
    'favorites',
    'follows'
  )
  AND cmd IN ('SELECT', 'ALL')
  AND (
    roles::text ILIKE '%anon%'
    OR roles::text ILIKE '%public%'
  )
ORDER BY tablename, policyname;

-- Expected result for query 2: 0 rows.

-- 3. Confirm required aggregate RPCs exist and are executable by anon/auth.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proacl AS grants
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'can_view_event',
    'get_event_friend_favorite_counts',
    'get_event_views_counts',
    'get_event_public_stats',
    'get_event_checkin_preview'
  )
ORDER BY p.proname;

-- 4. Manual API checks to run with Supabase anon key after migration:
-- - GET /rest/v1/bug_reports?select=id&limit=1 should return 401/403 or [].
-- - GET /rest/v1/event_checkins?select=id,user_id,event_id,lat,lon&limit=1 should return 401/403 or [].
-- - GET /rest/v1/event_views?select=id,event_id,profile_id&limit=1 should return 401/403 or [].
-- - GET /rest/v1/event_likes?select=event_id,user_id&limit=1 should return 401/403 or [].
-- - POST /rest/v1/rpc/get_event_public_stats with a public published event id should return aggregate counts only.
-- - Auth user A should not see auth user B rows in favorites/follows/notifications.
-- - Auth mobile clients should not have a direct INSERT policy on event_checkins;
--   check-ins must be written by the event-checkin Edge Function/service role.
