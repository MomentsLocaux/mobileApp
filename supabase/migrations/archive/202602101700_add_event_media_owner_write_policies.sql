-- Allow event creators (and moderators/admins) to write event_media rows
-- used by event creation/edit flows (gallery images).

ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_insert_owner_or_mod" ON public.event_media;
CREATE POLICY "event_media_insert_owner_or_mod"
  ON public.event_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.creator_id = auth.uid()
    )
    OR (auth.jwt()->>'role') IN ('moderateur', 'admin')
  );

DROP POLICY IF EXISTS "event_media_update_owner_or_mod" ON public.event_media;
CREATE POLICY "event_media_update_owner_or_mod"
  ON public.event_media
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.creator_id = auth.uid()
    )
    OR (auth.jwt()->>'role') IN ('moderateur', 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.creator_id = auth.uid()
    )
    OR (auth.jwt()->>'role') IN ('moderateur', 'admin')
  );

DROP POLICY IF EXISTS "event_media_delete_owner_or_mod" ON public.event_media;
CREATE POLICY "event_media_delete_owner_or_mod"
  ON public.event_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.creator_id = auth.uid()
    )
    OR (auth.jwt()->>'role') IN ('moderateur', 'admin')
  );
