-- Allow legitimate media submissions:
-- - attendee with a valid check-in
-- - event creator (owner)
-- - moderator/admin
-- while keeping author_id bound to auth.uid() and active profile checks.

ALTER TABLE public.event_media_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_media_submissions_insert_auth ON public.event_media_submissions;

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
    AND (
      EXISTS (
        SELECT 1
        FROM public.events e_owner
        WHERE e_owner.id = event_media_submissions.event_id
          AND e_owner.creator_id = auth.uid()
      )
      OR COALESCE(auth.jwt()->'app_metadata'->>'role', auth.jwt()->>'role') IN ('moderateur', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.event_checkins c
        WHERE c.event_id = event_media_submissions.event_id
          AND c.user_id = auth.uid()
      )
    )
  );
