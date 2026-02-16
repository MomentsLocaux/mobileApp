-- Add RLS policy for wallets (read own balance)

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own" ON wallets;
CREATE POLICY "wallets_select_own"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
