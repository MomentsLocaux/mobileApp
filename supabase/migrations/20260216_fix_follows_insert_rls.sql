BEGIN;

-- Keep follows RLS explicit and predictable.
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Normalize policy names/definitions (quoted and unquoted variants).
DROP POLICY IF EXISTS follows_select_auth ON public.follows;
DROP POLICY IF EXISTS "follows_select_auth" ON public.follows;
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;

CREATE POLICY follows_select_auth
  ON public.follows
  FOR SELECT
  TO authenticated
  USING (true);

-- Important: rely on auth.uid() = follower only.
-- The previous variant with is_profile_active(auth.uid()) can fail depending on
-- profile RLS visibility and ends up rejecting valid follow inserts (42501).
CREATE POLICY follows_insert_own
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower);

CREATE POLICY follows_delete_own
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower);

COMMIT;

