BEGIN;

-- Keep favorites RLS explicit and predictable.
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Normalize policy names/definitions (quoted and unquoted variants).
DROP POLICY IF EXISTS favorites_select_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
DROP POLICY IF EXISTS favorites_insert_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
DROP POLICY IF EXISTS favorites_delete_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;

CREATE POLICY favorites_select_own
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY favorites_insert_own
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY favorites_delete_own
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

COMMIT;
