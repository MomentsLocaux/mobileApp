-- Follow-up diagnostics for MVP-P0-004/P0-005 event creator writes.
-- Run after applying 20260604_restore_event_creator_write_policies.sql.
-- This file does not mutate data.

-- 1. Confirm event write policies exist.
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
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY cmd, policyname;

-- Expected:
-- - events_insert_creator with auth.uid() = creator_id and public.is_profile_active(auth.uid()).
-- - events_update_owner_or_mod with owner/mod checks.
-- - events_delete_owner_or_mod with owner/mod checks.

-- 2. Confirm lifecycle trigger is still active.
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

-- 3. Inventory profile statuses that can affect public.is_profile_active().
SELECT
  COALESCE(status::text, 'NULL') AS profile_status,
  COUNT(*) AS profile_count
FROM public.profiles
GROUP BY COALESCE(status::text, 'NULL')
ORDER BY profile_status;

-- 4. Manual app check:
-- - Authenticated active user can create/save a draft or submit pending event.
-- - Authenticated active user still cannot create published/refused/archived directly.
