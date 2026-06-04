BEGIN;

-- MVP-P0-011: block MVP writes for banned/suspended/non-active profiles.
-- Moderation/service-role flows keep their own backend privileges; public anon
-- event views remain allowed only without a user profile id.

CREATE OR REPLACE FUNCTION public.is_profile_active(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user
      AND COALESCE(p.status::text, 'active') = 'active'
      AND (p.ban_until IS NULL OR p.ban_until <= now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_profile_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profile_active(uuid) TO authenticated, service_role;

-- Events: creators must be active to create/update/delete.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_insert_creator ON public.events;
DROP POLICY IF EXISTS "events_insert_creator" ON public.events;
DROP POLICY IF EXISTS events_update_owner_or_mod ON public.events;
DROP POLICY IF EXISTS "events_update_owner_or_mod" ON public.events;
DROP POLICY IF EXISTS events_delete_owner_or_mod ON public.events;
DROP POLICY IF EXISTS "events_delete_owner_or_mod" ON public.events;

CREATE POLICY events_insert_creator
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY events_update_owner_or_mod
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  )
  WITH CHECK (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY events_delete_owner_or_mod
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

-- Reports and bug reports: active users can submit, moderators can review.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_insert_user ON public.reports;
DROP POLICY IF EXISTS "reports_insert_user" ON public.reports;
CREATE POLICY reports_insert_user
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND public.is_profile_active(auth.uid())
  );

DROP POLICY IF EXISTS bug_reports_insert_own ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_insert_own" ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_insert_any_auth ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_insert_any_auth" ON public.bug_reports;
CREATE POLICY bug_reports_insert_own
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND public.is_profile_active(auth.uid())
  );

-- Social writes: active profile required for create/remove interactions.
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media_submission_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY follows_insert_own
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower
    AND public.is_profile_active(auth.uid())
  );
CREATE POLICY follows_delete_own
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = follower
    AND public.is_profile_active(auth.uid())
  );

DROP POLICY IF EXISTS favorites_insert_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
DROP POLICY IF EXISTS favorites_delete_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY favorites_insert_own
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    AND public.is_profile_active(auth.uid())
  );
CREATE POLICY favorites_delete_own
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = profile_id
    AND public.is_profile_active(auth.uid())
  );

DROP POLICY IF EXISTS event_likes_insert_own ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_insert_own" ON public.event_likes;
DROP POLICY IF EXISTS event_likes_delete_own ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_delete_own" ON public.event_likes;
CREATE POLICY event_likes_insert_own
  ON public.event_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );
CREATE POLICY event_likes_delete_own
  ON public.event_likes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

DROP POLICY IF EXISTS comment_likes_insert_own ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_insert_own" ON public.comment_likes;
DROP POLICY IF EXISTS comment_likes_delete_own ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_delete_own" ON public.comment_likes;
CREATE POLICY comment_likes_insert_own
  ON public.comment_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );
CREATE POLICY comment_likes_delete_own
  ON public.comment_likes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

DROP POLICY IF EXISTS event_media_submission_likes_insert_own ON public.event_media_submission_likes;
DROP POLICY IF EXISTS "event_media_submission_likes_insert_own" ON public.event_media_submission_likes;
DROP POLICY IF EXISTS event_media_submission_likes_delete_own ON public.event_media_submission_likes;
DROP POLICY IF EXISTS "event_media_submission_likes_delete_own" ON public.event_media_submission_likes;
CREATE POLICY event_media_submission_likes_insert_own
  ON public.event_media_submission_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );
CREATE POLICY event_media_submission_likes_delete_own
  ON public.event_media_submission_likes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

DROP POLICY IF EXISTS event_interests_insert_own ON public.event_interests;
DROP POLICY IF EXISTS "event_interests_insert_own" ON public.event_interests;
CREATE POLICY event_interests_insert_own
  ON public.event_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

-- Event views: keep anonymous views possible, but profile-linked views require
-- an active authenticated profile.
ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_views_insert_public_visible ON public.event_views;
DROP POLICY IF EXISTS "event_views_insert_public_visible" ON public.event_views;
CREATE POLICY event_views_insert_public_visible
  ON public.event_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.can_view_event(event_id)
    AND (
      (auth.role() = 'anon' AND profile_id IS NULL)
      OR (
        auth.role() = 'authenticated'
        AND profile_id = auth.uid()
        AND public.is_profile_active(auth.uid())
      )
    )
  );

-- Official event media rows are creator/moderator writes, not community
-- submissions. Keep the active creator requirement explicit.
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_media_insert_owner_or_mod ON public.event_media;
DROP POLICY IF EXISTS "event_media_insert_owner_or_mod" ON public.event_media;
DROP POLICY IF EXISTS event_media_insert_mod ON public.event_media;
DROP POLICY IF EXISTS "event_media_insert_mod" ON public.event_media;
DROP POLICY IF EXISTS event_media_update_owner_or_mod ON public.event_media;
DROP POLICY IF EXISTS "event_media_update_owner_or_mod" ON public.event_media;
DROP POLICY IF EXISTS event_media_delete_owner_or_mod ON public.event_media;
DROP POLICY IF EXISTS "event_media_delete_owner_or_mod" ON public.event_media;

CREATE POLICY event_media_insert_owner_or_mod
  ON public.event_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = event_id
          AND e.creator_id = auth.uid()
      )
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY event_media_update_owner_or_mod
  ON public.event_media
  FOR UPDATE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = event_id
          AND e.creator_id = auth.uid()
      )
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = event_id
          AND e.creator_id = auth.uid()
      )
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY event_media_delete_owner_or_mod
  ON public.event_media
  FOR DELETE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = event_id
          AND e.creator_id = auth.uid()
      )
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

-- Storage writes: blocked for non-active profiles even if object path matches.
DROP POLICY IF EXISTS avatar_objects_insert_owner_path ON storage.objects;
DROP POLICY IF EXISTS avatar_objects_update_owner_path ON storage.objects;
DROP POLICY IF EXISTS avatar_objects_delete_owner_path ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_insert_owner_path ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_update_owner_path ON storage.objects;
DROP POLICY IF EXISTS event_media_objects_delete_owner_path ON storage.objects;

CREATE POLICY avatar_objects_insert_owner_path
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatar'
    AND owner = auth.uid()
    AND public.is_profile_active(auth.uid())
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
    AND public.is_profile_active(auth.uid())
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'profile-covers' AND split_part(name, '/', 2) = auth.uid()::text)
    )
  )
  WITH CHECK (
    bucket_id = 'avatar'
    AND owner = auth.uid()
    AND public.is_profile_active(auth.uid())
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
    AND public.is_profile_active(auth.uid())
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'profile-covers' AND split_part(name, '/', 2) = auth.uid()::text)
    )
  );

CREATE POLICY event_media_objects_insert_owner_path
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-media'
    AND owner = auth.uid()
    AND public.is_profile_active(auth.uid())
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
    AND public.is_profile_active(auth.uid())
    AND (
      (split_part(name, '/', 1) = 'event-covers' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'gallery' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'contrib' AND split_part(name, '/', 3) = auth.uid()::text)
    )
  )
  WITH CHECK (
    bucket_id = 'event-media'
    AND owner = auth.uid()
    AND public.is_profile_active(auth.uid())
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
    AND public.is_profile_active(auth.uid())
    AND (
      (split_part(name, '/', 1) = 'event-covers' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'gallery' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'contrib' AND split_part(name, '/', 3) = auth.uid()::text)
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
