-- MVP-P0-011 read-only diagnostics.
-- Run after applying 20260604_block_inactive_profile_writes.sql and deploying event-checkin.
-- This file does not mutate data or policies.

-- 1. Inspect write policies on MVP user-write tables.
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
    'events',
    'event_media',
    'event_comments',
    'reports',
    'bug_reports',
    'follows',
    'favorites',
    'event_likes',
    'comment_likes',
    'event_media_submissions',
    'event_media_submission_likes',
    'event_interests',
    'event_views'
  )
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
ORDER BY tablename, cmd, policyname;

-- 2. Flag user INSERT policies that still do not check active profile.
-- Moderator-only policies are intentionally excluded.
SELECT
  tablename,
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'events',
    'event_media',
    'event_comments',
    'reports',
    'bug_reports',
    'follows',
    'favorites',
    'event_likes',
    'comment_likes',
    'event_media_submissions',
    'event_media_submission_likes',
    'event_interests'
  )
  AND cmd = 'INSERT'
  AND roles::text ILIKE '%authenticated%'
  AND COALESCE(with_check, '') NOT ILIKE '%is_profile_active%'
  AND COALESCE(with_check, '') NOT ILIKE '%is_moderator%'
ORDER BY tablename, policyname;

-- Expected result for query 2: 0 rows.

-- 3. Confirm Storage write policies also require active profile.
SELECT
  policyname,
  cmd,
  with_check,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'avatar_objects_insert_owner_path',
    'avatar_objects_update_owner_path',
    'avatar_objects_delete_owner_path',
    'event_media_objects_insert_owner_path',
    'event_media_objects_update_owner_path',
    'event_media_objects_delete_owner_path'
  )
ORDER BY policyname;

-- 4. Manual staging checks:
-- - Set a test profile status to suspended.
-- - As that user, try to create an event, comment, follow, favorite, like, report, bug report,
--   upload avatar/event media, submit event media, and check in.
-- - Expected: each write fails with 401/403/42501 or an app error.
-- - Restore profile status to active.
-- - Expected: normal MVP writes work again.
