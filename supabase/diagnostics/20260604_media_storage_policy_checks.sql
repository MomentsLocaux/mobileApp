-- MVP-P0-010 read-only diagnostics.
-- Run after applying 20260604_secure_media_storage_policies.sql.
-- This file does not mutate storage objects or policies.

-- 1. Confirm expected buckets exist and are public-read buckets.
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id IN ('avatar', 'event-media', 'public')
ORDER BY id;

-- Expected:
-- - avatar public = true
-- - event-media public = true
-- - public may exist for legacy cleanup, but mobile code must not upload there.

-- 2. Inspect media storage policies.
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'avatar_objects_select_public',
    'avatar_objects_insert_owner_path',
    'avatar_objects_update_owner_path',
    'avatar_objects_delete_owner_path',
    'event_media_objects_select_public',
    'event_media_objects_insert_owner_path',
    'event_media_objects_update_owner_path',
    'event_media_objects_delete_owner_path'
  )
ORDER BY policyname;

-- 3. Inventory legacy media objects still living in generic public bucket.
SELECT
  bucket_id,
  split_part(name, '/', 1) AS top_level_folder,
  COUNT(*) AS object_count
FROM storage.objects
WHERE bucket_id = 'public'
GROUP BY bucket_id, split_part(name, '/', 1)
ORDER BY object_count DESC, top_level_folder;

-- 4. Manual checks:
-- - Auth user can upload avatar to avatar/avatars/{ownUserId}/...
-- - Auth user cannot upload avatar/avatars/{otherUserId}/...
-- - Auth user can upload event cover to event-media/event-covers/{ownUserId}/...
-- - Auth user cannot upload event-media/event-covers/{otherUserId}/...
-- - Mobile upload fails with a clear error if avatar or event-media bucket is missing.
