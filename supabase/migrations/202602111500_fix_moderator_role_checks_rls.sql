BEGIN;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(auth.jwt()->'app_metadata'->>'role', auth.jwt()->>'role') IN ('moderateur', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('moderateur', 'admin')
    );
$$;

-- PROFILES
DROP POLICY IF EXISTS profiles_update_moderation ON public.profiles;
CREATE POLICY profiles_update_moderation
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- EVENTS
DROP POLICY IF EXISTS events_select_auth ON public.events;
DROP POLICY IF EXISTS events_insert_creator ON public.events;
DROP POLICY IF EXISTS events_update_owner_or_mod ON public.events;
DROP POLICY IF EXISTS events_delete_owner_or_mod ON public.events;

CREATE POLICY events_select_auth
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    (visibility = 'public' AND status = 'published')
    OR creator_id = auth.uid()
    OR public.is_moderator()
  );

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

-- EVENT_COMMENTS
DROP POLICY IF EXISTS event_comments_select_auth ON public.event_comments;
DROP POLICY IF EXISTS event_comments_update_author_or_mod ON public.event_comments;
DROP POLICY IF EXISTS event_comments_delete_author_or_mod ON public.event_comments;

CREATE POLICY event_comments_select_auth
  ON public.event_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_comments.event_id
        AND e.visibility = 'public'
        AND e.status = 'published'
    )
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_comments.event_id
        AND e.creator_id = auth.uid()
    )
    OR public.is_moderator()
  );

CREATE POLICY event_comments_update_author_or_mod
  ON public.event_comments
  FOR UPDATE
  TO authenticated
  USING (
    (
      auth.uid() = author_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  )
  WITH CHECK (
    (
      auth.uid() = author_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY event_comments_delete_author_or_mod
  ON public.event_comments
  FOR DELETE
  TO authenticated
  USING (
    (
      auth.uid() = author_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

-- EVENT_MEDIA
DROP POLICY IF EXISTS event_media_insert_owner_or_mod ON public.event_media;
DROP POLICY IF EXISTS event_media_update_owner_or_mod ON public.event_media;
DROP POLICY IF EXISTS event_media_delete_owner_or_mod ON public.event_media;

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

-- EVENT_MEDIA_SUBMISSIONS
DROP POLICY IF EXISTS event_media_submissions_select_mod ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_update_mod ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_delete_mod ON public.event_media_submissions;

CREATE POLICY event_media_submissions_select_mod
  ON public.event_media_submissions
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

CREATE POLICY event_media_submissions_update_mod
  ON public.event_media_submissions
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

CREATE POLICY event_media_submissions_delete_mod
  ON public.event_media_submissions
  FOR DELETE
  TO authenticated
  USING (public.is_moderator());

-- REPORTS
DROP POLICY IF EXISTS reports_select_mod ON public.reports;
DROP POLICY IF EXISTS reports_update_mod ON public.reports;

CREATE POLICY reports_select_mod
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

CREATE POLICY reports_update_mod
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- WARNINGS
DROP POLICY IF EXISTS warnings_select_mod ON public.warnings;
DROP POLICY IF EXISTS warnings_insert_mod ON public.warnings;

CREATE POLICY warnings_select_mod
  ON public.warnings
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

CREATE POLICY warnings_insert_mod
  ON public.warnings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

-- MODERATION_ACTIONS
DROP POLICY IF EXISTS moderation_actions_select_mod ON public.moderation_actions;
DROP POLICY IF EXISTS moderation_actions_insert_mod ON public.moderation_actions;

CREATE POLICY moderation_actions_select_mod
  ON public.moderation_actions
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

CREATE POLICY moderation_actions_insert_mod
  ON public.moderation_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

-- NOTIFICATIONS
DROP POLICY IF EXISTS notifications_insert_mod ON public.notifications;
CREATE POLICY notifications_insert_mod
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

COMMIT;
