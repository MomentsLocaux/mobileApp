-- Add RLS policy for event_media

ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_select_auth" ON event_media;
CREATE POLICY "event_media_select_auth"
  ON event_media
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_event_media_event_id ON event_media(event_id);
