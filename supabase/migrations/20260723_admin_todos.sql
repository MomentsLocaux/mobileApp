-- Admin console personal todos (per authenticated moderator/admin).
-- Do NOT apply without human validation (AGENTS.md).
-- Apply on DEV first, then UAT.

CREATE TABLE IF NOT EXISTS public.admin_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  done boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly')),
  template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_todos_user_id_idx
  ON public.admin_todos (user_id);

CREATE INDEX IF NOT EXISTS admin_todos_user_done_created_idx
  ON public.admin_todos (user_id, done, created_at DESC);

COMMENT ON TABLE public.admin_todos IS
  'Personal todo items for Web Console moderators/admins. Scoped by RLS to auth.uid().';

ALTER TABLE public.admin_todos ENABLE ROW LEVEL SECURITY;

-- Reuse existing helper (SECURITY DEFINER) from contests/moderation migrations.
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

DROP POLICY IF EXISTS admin_todos_select_own ON public.admin_todos;
CREATE POLICY admin_todos_select_own
  ON public.admin_todos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.is_moderator());

DROP POLICY IF EXISTS admin_todos_insert_own ON public.admin_todos;
CREATE POLICY admin_todos_insert_own
  ON public.admin_todos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_moderator());

DROP POLICY IF EXISTS admin_todos_update_own ON public.admin_todos;
CREATE POLICY admin_todos_update_own
  ON public.admin_todos
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_moderator())
  WITH CHECK (user_id = auth.uid() AND public.is_moderator());

DROP POLICY IF EXISTS admin_todos_delete_own ON public.admin_todos;
CREATE POLICY admin_todos_delete_own
  ON public.admin_todos
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_moderator());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_todos TO authenticated;
