BEGIN;

-- MVP-P0-010: explicit media buckets and owner-scoped object paths.
-- The mobile app must not fallback to the generic "public" bucket.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatar', 'avatar', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-media', 'event-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS avatar_objects_insert_owner_path ON storage.objects;
DROP POLICY IF EXISTS avatar_objects_select_public ON storage.objects;
DROP POLICY IF EXISTS avatar_objects_update_owner_path ON storage.objects;
DROP POLICY IF EXISTS avatar_objects_delete_owner_path ON storage.objects;

DROP POLICY IF EXISTS event_media_objects_insert_owner_path ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_select_public ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_update_owner_path ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_delete_owner_path ON storage.objects;

CREATE POLICY avatar_objects_select_public
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatar');

CREATE POLICY avatar_objects_insert_owner_path
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatar'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'profile-covers' AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

CREATE POLICY avatar_objects_update_owner_path
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatar'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'profile-covers' AND split_part(name, '/', 2) = auth.uid()::text)
    )
  )
  WITH CHECK (
    bucket_id = 'avatar'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'profile-covers' AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

CREATE POLICY avatar_objects_delete_owner_path
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatar'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'profile-covers' AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

CREATE POLICY event_media_objects_select_public
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-media');

CREATE POLICY event_media_objects_insert_owner_path
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-media'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'event-covers' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'gallery' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'contrib' AND split_part(name, '/', 3) = auth.uid()::text)
    )
  );

CREATE POLICY event_media_objects_update_owner_path
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'event-covers' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'gallery' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'contrib' AND split_part(name, '/', 3) = auth.uid()::text)
    )
  )
  WITH CHECK (
    bucket_id = 'event-media'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'event-covers' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'gallery' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'contrib' AND split_part(name, '/', 3) = auth.uid()::text)
    )
  );

CREATE POLICY event_media_objects_delete_owner_path
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND owner = auth.uid()
    AND (
      (split_part(name, '/', 1) = 'event-covers' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'gallery' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'contrib' AND split_part(name, '/', 3) = auth.uid()::text)
    )
  );

COMMIT;
