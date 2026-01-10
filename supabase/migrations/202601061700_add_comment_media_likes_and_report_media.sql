-- Add comment/media likes + allow reporting media

-- Extend reports target_type to support media
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type = ANY (ARRAY['event'::text, 'comment'::text, 'user'::text, 'challenge'::text, 'media'::text]));

-- Comment likes
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id uuid NOT NULL REFERENCES event_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes_select_own" ON comment_likes;
CREATE POLICY "comment_likes_select_own"
  ON comment_likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_likes_insert_own" ON comment_likes;
CREATE POLICY "comment_likes_insert_own"
  ON comment_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_likes_delete_own" ON comment_likes;
CREATE POLICY "comment_likes_delete_own"
  ON comment_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- Community media likes (approved submissions)
CREATE TABLE IF NOT EXISTS event_media_submission_likes (
  submission_id uuid NOT NULL REFERENCES event_media_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);

ALTER TABLE event_media_submission_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_submission_likes_select_own" ON event_media_submission_likes;
CREATE POLICY "event_media_submission_likes_select_own"
  ON event_media_submission_likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_media_submission_likes_insert_own" ON event_media_submission_likes;
CREATE POLICY "event_media_submission_likes_insert_own"
  ON event_media_submission_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_media_submission_likes_delete_own" ON event_media_submission_likes;
CREATE POLICY "event_media_submission_likes_delete_own"
  ON event_media_submission_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_media_submission_likes_submission_id ON event_media_submission_likes(submission_id);
CREATE INDEX IF NOT EXISTS idx_event_media_submission_likes_user_id ON event_media_submission_likes(user_id);
