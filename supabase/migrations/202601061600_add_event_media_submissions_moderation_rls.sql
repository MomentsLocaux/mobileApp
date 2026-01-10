-- Allow moderators/admins to review community photo submissions and publish to event_media

ALTER TABLE event_media_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_submissions_select_mod" ON event_media_submissions;
CREATE POLICY "event_media_submissions_select_mod"
  ON event_media_submissions
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "event_media_submissions_update_mod" ON event_media_submissions;
CREATE POLICY "event_media_submissions_update_mod"
  ON event_media_submissions
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'))
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_insert_mod" ON event_media;
CREATE POLICY "event_media_insert_mod"
  ON event_media
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));
