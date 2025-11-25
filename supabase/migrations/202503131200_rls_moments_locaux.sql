-- RLS policies for Moments Locaux
-- Tables: profiles, events, event_comments, favorites, interests, lumo_transactions, bug_reports
-- Roles expected in JWT: denicheur, createur, moderateur, admin

-- Helper expressions (for readability in policies):
--   auth.uid()                         -> current user id
--   (auth.jwt()->>'role')              -> role string
--   (auth.jwt()->>'role') IN (...)     -> role check

--------------------------------------------------------------------------------
-- PROFILES
--------------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_auth_or_own" ON profiles;
CREATE POLICY "profiles_select_auth_or_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true); -- allow authenticated users to view profiles

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_moderation" ON profiles;
CREATE POLICY "profiles_update_moderation"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'))
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

--------------------------------------------------------------------------------
-- EVENTS
--------------------------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_auth" ON events;
CREATE POLICY "events_select_auth"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "events_insert_creator" ON events;
CREATE POLICY "events_insert_creator"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "events_update_owner_or_mod" ON events;
CREATE POLICY "events_update_owner_or_mod"
  ON events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'))
  WITH CHECK (auth.uid() = creator_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "events_delete_owner_or_mod" ON events;
CREATE POLICY "events_delete_owner_or_mod"
  ON events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id);

--------------------------------------------------------------------------------
-- EVENT_COMMENTS
--------------------------------------------------------------------------------
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_comments_select_auth" ON event_comments;
CREATE POLICY "event_comments_select_auth"
  ON event_comments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "event_comments_insert_author" ON event_comments;
CREATE POLICY "event_comments_insert_author"
  ON event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "event_comments_update_author_or_mod" ON event_comments;
CREATE POLICY "event_comments_update_author_or_mod"
  ON event_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'))
  WITH CHECK (auth.uid() = author_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "event_comments_delete_author_or_mod" ON event_comments;
CREATE POLICY "event_comments_delete_author_or_mod"
  ON event_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_comments_author_id ON event_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON event_comments(event_id);

--------------------------------------------------------------------------------
-- FAVORITES
--------------------------------------------------------------------------------
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
CREATE POLICY "favorites_select_own"
  ON favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
CREATE POLICY "favorites_insert_own"
  ON favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_delete_own"
  ON favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_favorites_profile_id ON favorites(profile_id);
CREATE INDEX IF NOT EXISTS idx_favorites_event_id ON favorites(event_id);

--------------------------------------------------------------------------------
-- EVENT_INTERESTS
--------------------------------------------------------------------------------
ALTER TABLE event_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_interests_select_own" ON event_interests;
CREATE POLICY "event_interests_select_own"
  ON event_interests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_interests_insert_own" ON event_interests;
CREATE POLICY "event_interests_insert_own"
  ON event_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_interests_delete_own" ON event_interests;
CREATE POLICY "event_interests_delete_own"
  ON event_interests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_interests_user_id ON event_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_event_interests_event_id ON event_interests(event_id);

--------------------------------------------------------------------------------
-- EVENT_MEDIA
--------------------------------------------------------------------------------
ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_media_select_auth" ON event_media;
CREATE POLICY "event_media_select_auth"
  ON event_media
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_media_event_id ON event_media(event_id);

--------------------------------------------------------------------------------
-- LUMO_TRANSACTIONS
--------------------------------------------------------------------------------
-- Rename legacy table if it exists
ALTER TABLE IF EXISTS transactions RENAME TO lumo_transactions;

ALTER TABLE lumo_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lumo_transactions_select_own_or_mod" ON lumo_transactions;
CREATE POLICY "lumo_transactions_select_own_or_mod"
  ON lumo_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "lumo_transactions_insert_own_or_mod" ON lumo_transactions;
CREATE POLICY "lumo_transactions_insert_own_or_mod"
  ON lumo_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

-- Typically no update/delete; add only if needed

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lumo_transactions_user_id ON lumo_transactions(user_id);

--------------------------------------------------------------------------------
-- BUG_REPORTS
--------------------------------------------------------------------------------
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bug_reports_select_owner_or_mod" ON bug_reports;
CREATE POLICY "bug_reports_select_owner_or_mod"
  ON bug_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR (auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "bug_reports_insert_any_auth" ON bug_reports;
CREATE POLICY "bug_reports_insert_any_auth"
  ON bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "bug_reports_update_mod_only" ON bug_reports;
CREATE POLICY "bug_reports_update_mod_only"
  ON bug_reports
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'))
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "bug_reports_delete_mod_only" ON bug_reports;
CREATE POLICY "bug_reports_delete_mod_only"
  ON bug_reports
  FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter_id ON bug_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);

--------------------------------------------------------------------------------
-- ROLLBACK NOTES (manual)
--------------------------------------------------------------------------------
-- To disable RLS on a table:
--   ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
-- To drop a policy:
--   DROP POLICY IF EXISTS "<policy_name>" ON <table>;
