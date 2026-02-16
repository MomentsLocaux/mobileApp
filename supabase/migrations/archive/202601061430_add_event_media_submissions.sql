/*
  # Add event_media_submissions table

  - Allow authenticated users to submit photos for events (pending moderation).
  - Allow creators to review (approve/reject) submissions.
  - Allow public to read approved submissions.
*/

CREATE TABLE IF NOT EXISTS event_media_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_media_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_submissions_insert_auth" ON event_media_submissions;
CREATE POLICY "event_media_submissions_insert_auth"
  ON event_media_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "event_media_submissions_select_approved" ON event_media_submissions;
CREATE POLICY "event_media_submissions_select_approved"
  ON event_media_submissions
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "event_media_submissions_select_own" ON event_media_submissions;
CREATE POLICY "event_media_submissions_select_own"
  ON event_media_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "event_media_submissions_select_creator" ON event_media_submissions;
CREATE POLICY "event_media_submissions_select_creator"
  ON event_media_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = event_media_submissions.event_id
        AND events.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_media_submissions_update_creator" ON event_media_submissions;
CREATE POLICY "event_media_submissions_update_creator"
  ON event_media_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = event_media_submissions.event_id
        AND events.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = event_media_submissions.event_id
        AND events.creator_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_event_media_submissions_event_id ON event_media_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_media_submissions_author_id ON event_media_submissions(author_id);
CREATE INDEX IF NOT EXISTS idx_event_media_submissions_status ON event_media_submissions(status);
