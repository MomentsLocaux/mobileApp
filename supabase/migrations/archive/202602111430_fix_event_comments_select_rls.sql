BEGIN;

DROP POLICY IF EXISTS event_comments_select_public ON public.event_comments;
DROP POLICY IF EXISTS event_comments_select_auth ON public.event_comments;

CREATE POLICY event_comments_select_public
  ON public.event_comments
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_comments.event_id
        AND e.visibility = 'public'
        AND e.status = 'published'
    )
  );

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
    OR (auth.jwt()->>'role') IN ('moderateur','admin')
  );

COMMIT;
