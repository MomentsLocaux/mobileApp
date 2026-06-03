-- MVP-P0-004 read-only diagnostics.
-- Run after applying 20260603_secure_event_access_rpc.sql in staging.
-- This file does not mutate data or policies.

-- 1. Inspect event SELECT policies.
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
  AND tablename = 'events'
  AND cmd IN ('SELECT', 'ALL')
ORDER BY policyname;

-- Expected:
-- - anon/public SELECT only allows visibility = 'public' AND status = 'published'.
-- - authenticated SELECT uses public.can_view_event(id).

-- 2. Confirm hardened RPC/helper exist.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proacl AS grants
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('can_view_event', 'get_events_by_ids')
ORDER BY p.proname;

-- 3. Inventory non-public events available for manual API/RPC checks.
-- This runs as the SQL Editor role and is not an anon visibility check.
SELECT status, visibility, COUNT(*) AS event_count
FROM public.events
WHERE NOT (status = 'published' AND visibility = 'public')
GROUP BY status, visibility
ORDER BY status, visibility;

-- 4. Manual API checks after migration with anon/auth clients:
-- - anon GET /rest/v1/events?select=id,status,visibility&status=neq.published returns 401/403 or [].
-- - anon POST /rest/v1/rpc/get_events_by_ids with draft/pending/refused/archived/private ids returns [].
-- - auth non-owner POST /rest/v1/rpc/get_events_by_ids with non-public ids returns [].
-- - owner can read own draft/pending/refused/archived events via MyEvents/detail.
-- - invited user can read published private event from private_invite notification.
-- - map/list still return only published/public events.
