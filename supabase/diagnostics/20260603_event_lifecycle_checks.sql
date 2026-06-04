-- MVP-P0-005 read-only diagnostics.
-- Run after applying 20260603_lock_event_lifecycle.sql in staging.
-- This file does not mutate data or policies.

-- 1. Confirm lifecycle trigger is installed on public.events.
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'events'
  AND t.tgname = 'trg_enforce_event_lifecycle';

-- Expected: one row, enabled = 'O', function_name = 'enforce_event_lifecycle'.

-- 2. Inspect owner/moderator update policies that still delegate lifecycle to the trigger.
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
  AND cmd IN ('UPDATE', 'ALL')
ORDER BY policyname;

-- 3. Inventory events available for manual lifecycle checks.
-- This runs as the SQL Editor role and is not a client permission check.
SELECT status, visibility, COUNT(*) AS event_count
FROM public.events
GROUP BY status, visibility
ORDER BY status, visibility;

-- 4. Manual client/API checks after migration:
-- - creator can create draft.
-- - creator can submit new event as pending.
-- - creator cannot create published/refused/archived directly.
-- - creator can update own draft and keep it draft.
-- - creator can update own draft/refused to pending.
-- - creator cannot update own pending, published or archived event.
-- - creator cannot change creator_id.
-- - moderator/service role can still perform moderation transitions.
