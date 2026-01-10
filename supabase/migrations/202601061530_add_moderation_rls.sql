-- RLS policies for moderation tables (moderator/admin access)

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_actions_select_mod" ON moderation_actions;
CREATE POLICY "moderation_actions_select_mod"
  ON moderation_actions
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "moderation_actions_insert_mod" ON moderation_actions;
CREATE POLICY "moderation_actions_insert_mod"
  ON moderation_actions
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "reports_select_mod" ON reports;
CREATE POLICY "reports_select_mod"
  ON reports
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "reports_update_mod" ON reports;
CREATE POLICY "reports_update_mod"
  ON reports
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'))
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "warnings_select_mod" ON warnings;
CREATE POLICY "warnings_select_mod"
  ON warnings
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') IN ('moderateur', 'admin'));

DROP POLICY IF EXISTS "warnings_insert_mod" ON warnings;
CREATE POLICY "warnings_insert_mod"
  ON warnings
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role') IN ('moderateur', 'admin'));
