-- MVP-P0-006 read-only diagnostics.
-- Run after applying 20260604_account_deletion_flow.sql and deploying delete-account.
-- This file does not mutate data.

-- 1. Confirm deletion request table and RPC exist.
SELECT to_regclass('public.account_deletion_requests') AS account_deletion_requests_table;

SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proacl AS grants
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'process_account_deletion'
ORDER BY p.proname;

-- 2. Confirm lifecycle trigger still exists after replacement.
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

-- 3. Inspect deletion request RLS.
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
  AND tablename = 'account_deletion_requests'
ORDER BY policyname;

-- 4. Manual staging checks:
-- - Deploy Edge Function: npx supabase functions deploy delete-account
-- - From an authenticated test account, tap Settings > Privacy > Delete account.
-- - Expected: app shows success, local session is cleared, account cannot restore via biometrics.
-- - account_deletion_requests has one processed/auth_deleted row for the test user.
-- - profiles row is anonymized: email/avatar/bio/city/socials null, display_name = Utilisateur supprimé.
-- - user private rows are gone from notifications/favorites/follows/checkins/views/likes/bug_reports.
-- - user's non-public events are archived/private with contact fields removed.
