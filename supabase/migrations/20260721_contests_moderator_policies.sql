-- Allow moderators/admins (Web Console) to manage contests.
-- Contests tables currently have RLS enabled with 0 policies (deny-all for clients).
-- Mobile users still cannot create contests; only is_moderator() / service_role can mutate.
--
-- Applied via Supabase MCP on 2026-07-21:
--   DEV  prymkgkafaovhzopslea (moments-locaux-dev)
--   UAT  ieehuzeotwagkkprohjr (moments-locaux-uat)

BEGIN;

-- Ensure helper exists (idempotent with existing deployments).
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(auth.jwt()->'app_metadata'->>'role', auth.jwt()->>'role') IN ('moderateur', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('moderateur', 'admin')
    );
$$;

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contests_select_moderator ON public.contests;
CREATE POLICY contests_select_moderator
  ON public.contests
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS contests_insert_moderator ON public.contests;
CREATE POLICY contests_insert_moderator
  ON public.contests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS contests_update_moderator ON public.contests;
CREATE POLICY contests_update_moderator
  ON public.contests
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS contests_delete_moderator ON public.contests;
CREATE POLICY contests_delete_moderator
  ON public.contests
  FOR DELETE
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS contest_entries_select_moderator ON public.contest_entries;
CREATE POLICY contest_entries_select_moderator
  ON public.contest_entries
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS contest_entries_update_moderator ON public.contest_entries;
CREATE POLICY contest_entries_update_moderator
  ON public.contest_entries
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

COMMIT;
