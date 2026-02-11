BEGIN;

-- =====================================================
-- ENABLE RLS ON ALL RELEVANT TABLES
-- =====================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media_submission_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_profile_active(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user
      AND p.status = 'active'
      AND (p.ban_until IS NULL OR p.ban_until <= now())
  );
$$;

-- =====================================================
-- EVENTS
-- =====================================================

DROP POLICY IF EXISTS events_select_public ON public.events;
DROP POLICY IF EXISTS events_select_auth ON public.events;
DROP POLICY IF EXISTS events_insert_creator ON public.events;
DROP POLICY IF EXISTS events_update_owner_or_mod ON public.events;
DROP POLICY IF EXISTS events_delete_owner_or_mod ON public.events;

CREATE POLICY events_select_public
  ON public.events
  FOR SELECT
  TO anon
  USING (visibility = 'public' AND status = 'published');

CREATE POLICY events_select_auth
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    (visibility = 'public' AND status = 'published')
    OR creator_id = auth.uid()
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  )
  WITH CHECK (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  );

-- =====================================================
-- COMMENTS
-- =====================================================

DROP POLICY IF EXISTS event_comments_insert_author ON public.event_comments;
DROP POLICY IF EXISTS event_comments_update_author_or_mod ON public.event_comments;
DROP POLICY IF EXISTS event_comments_delete_author_or_mod ON public.event_comments;

CREATE POLICY event_comments_insert_author
  ON public.event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_profile_active(auth.uid())
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  )
  WITH CHECK (
    (
      auth.uid() = author_id
      AND public.is_profile_active(auth.uid())
    )
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  );

-- =====================================================
-- INTERACTIONS (BLOCK NON ACTIVE USERS)
-- =====================================================

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
DROP POLICY IF EXISTS favorites_insert_own ON public.favorites;
DROP POLICY IF EXISTS event_interests_insert_own ON public.event_interests;
DROP POLICY IF EXISTS comment_likes_insert_own ON public.comment_likes;
DROP POLICY IF EXISTS event_media_submission_likes_insert_own ON public.event_media_submission_likes;

CREATE POLICY follows_insert_own
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower
    AND public.is_profile_active(auth.uid())
  );

CREATE POLICY favorites_insert_own
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    AND public.is_profile_active(auth.uid())
  );

CREATE POLICY event_interests_insert_own
  ON public.event_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

CREATE POLICY comment_likes_insert_own
  ON public.comment_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

CREATE POLICY event_media_submission_likes_insert_own
  ON public.event_media_submission_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_profile_active(auth.uid())
  );

-- =====================================================
-- MEDIA SUBMISSIONS (STRICT MODERATION)
-- =====================================================

DROP POLICY IF EXISTS event_media_submissions_insert_auth ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_update_creator ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_update_mod ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_delete_mod ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_select_public ON public.event_media_submissions;
DROP POLICY IF EXISTS event_media_submissions_select_mod ON public.event_media_submissions;

CREATE POLICY event_media_submissions_insert_auth
  ON public.event_media_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_profile_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_media_submissions.event_id
        AND e.status = 'published'
    )
    AND EXISTS (
      SELECT 1 FROM public.event_checkins c
      WHERE c.event_id = event_media_submissions.event_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY event_media_submissions_select_public
  ON public.event_media_submissions
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY event_media_submissions_select_mod
  ON public.event_media_submissions
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'));

CREATE POLICY event_media_submissions_update_mod
  ON public.event_media_submissions
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'))
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur','admin'));

CREATE POLICY event_media_submissions_delete_mod
  ON public.event_media_submissions
  FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'));

-- =====================================================
-- REPORTS
-- =====================================================

DROP POLICY IF EXISTS reports_insert_auth ON public.reports;
DROP POLICY IF EXISTS reports_insert_user ON public.reports;
DROP POLICY IF EXISTS reports_select_mod ON public.reports;
DROP POLICY IF EXISTS reports_update_mod ON public.reports;

CREATE POLICY reports_insert_user
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND public.is_profile_active(auth.uid())
  );

CREATE POLICY reports_select_mod
  ON public.reports
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'));

CREATE POLICY reports_update_mod
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'))
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur','admin'));

-- =====================================================
-- WARNINGS & MODERATION LOGS
-- =====================================================

DROP POLICY IF EXISTS warnings_select_mod ON public.warnings;
DROP POLICY IF EXISTS moderation_actions_select_mod ON public.moderation_actions;

CREATE POLICY warnings_select_mod
  ON public.warnings
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'));

CREATE POLICY moderation_actions_select_mod
  ON public.moderation_actions
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur','admin'));

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_mod ON public.notifications;

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_insert_mod
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') IN ('moderateur','admin')
  );
-- EVENT_MEDIA: block non-active owners, keep mod/admin override
DROP POLICY IF EXISTS event_media_insert_owner_or_mod ON public.event_media;
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  );

DROP POLICY IF EXISTS event_media_update_owner_or_mod ON public.event_media;
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  );

DROP POLICY IF EXISTS event_media_delete_owner_or_mod ON public.event_media;
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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  );

COMMIT;
