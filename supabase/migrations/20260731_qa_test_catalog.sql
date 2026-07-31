-- QA test catalog + campaign executions for Moderation Web Console.
-- Apply on DEV/UAT after deploy of console Cahiers de tests section.

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

-- ---------------------------------------------------------------------------
-- Catalogue (versionné en code, upsert depuis la console)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_test_cases (
  id text PRIMARY KEY,
  repo text NOT NULL CHECK (repo IN ('mobile', 'console', 'scrapper', 'website')),
  module text NOT NULL,
  title text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  test_type text NOT NULL CHECK (
    test_type IN ('smoke', 'functional', 'regression', 'exploratory', 'data', 'ops')
  ),
  preconditions text,
  steps text[] NOT NULL DEFAULT '{}',
  expected text NOT NULL,
  platforms text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_test_cases_repo_active_idx
  ON public.qa_test_cases (repo, active, sort_order);

CREATE INDEX IF NOT EXISTS qa_test_cases_repo_module_idx
  ON public.qa_test_cases (repo, module);

COMMENT ON TABLE public.qa_test_cases IS
  'QA test case catalog for Moments Locaux products. Seeded from moderation console.';

-- ---------------------------------------------------------------------------
-- Campagnes de recette
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  repo text CHECK (repo IS NULL OR repo IN ('mobile', 'console', 'scrapper', 'website')),
  environment text NOT NULL DEFAULT 'dev' CHECK (environment IN ('dev', 'uat', 'prod')),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled')),
  target_version text,
  started_at timestamptz,
  closed_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_campaigns_status_created_idx
  ON public.qa_campaigns (status, created_at DESC);

CREATE INDEX IF NOT EXISTS qa_campaigns_repo_status_idx
  ON public.qa_campaigns (repo, status);

COMMENT ON TABLE public.qa_campaigns IS
  'QA recipe campaigns. repo NULL means multi-repo campaign.';

-- ---------------------------------------------------------------------------
-- Exécutions (1 cas × 1 campagne)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.qa_campaigns (id) ON DELETE CASCADE,
  test_case_id text NOT NULL REFERENCES public.qa_test_cases (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'passed', 'failed', 'blocked', 'skipped')),
  actual_result text,
  platform text,
  assignee_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  executed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, test_case_id)
);

CREATE INDEX IF NOT EXISTS qa_executions_campaign_status_idx
  ON public.qa_executions (campaign_id, status);

CREATE INDEX IF NOT EXISTS qa_executions_assignee_idx
  ON public.qa_executions (assignee_id)
  WHERE assignee_id IS NOT NULL;

COMMENT ON TABLE public.qa_executions IS
  'Per-campaign execution status for a catalog test case.';

-- ---------------------------------------------------------------------------
-- Commentaires sur exécution
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_execution_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.qa_executions (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_execution_comments_execution_created_idx
  ON public.qa_execution_comments (execution_id, created_at ASC);

COMMENT ON TABLE public.qa_execution_comments IS
  'Threaded comments on a QA execution.';

-- ---------------------------------------------------------------------------
-- RLS — moderateurs / admins only
-- ---------------------------------------------------------------------------
ALTER TABLE public.qa_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_execution_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_test_cases_select_mod ON public.qa_test_cases;
CREATE POLICY qa_test_cases_select_mod
  ON public.qa_test_cases FOR SELECT TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_test_cases_insert_mod ON public.qa_test_cases;
CREATE POLICY qa_test_cases_insert_mod
  ON public.qa_test_cases FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS qa_test_cases_update_mod ON public.qa_test_cases;
CREATE POLICY qa_test_cases_update_mod
  ON public.qa_test_cases FOR UPDATE TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS qa_test_cases_delete_mod ON public.qa_test_cases;
CREATE POLICY qa_test_cases_delete_mod
  ON public.qa_test_cases FOR DELETE TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_campaigns_select_mod ON public.qa_campaigns;
CREATE POLICY qa_campaigns_select_mod
  ON public.qa_campaigns FOR SELECT TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_campaigns_insert_mod ON public.qa_campaigns;
CREATE POLICY qa_campaigns_insert_mod
  ON public.qa_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS qa_campaigns_update_mod ON public.qa_campaigns;
CREATE POLICY qa_campaigns_update_mod
  ON public.qa_campaigns FOR UPDATE TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS qa_campaigns_delete_mod ON public.qa_campaigns;
CREATE POLICY qa_campaigns_delete_mod
  ON public.qa_campaigns FOR DELETE TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_executions_select_mod ON public.qa_executions;
CREATE POLICY qa_executions_select_mod
  ON public.qa_executions FOR SELECT TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_executions_insert_mod ON public.qa_executions;
CREATE POLICY qa_executions_insert_mod
  ON public.qa_executions FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS qa_executions_update_mod ON public.qa_executions;
CREATE POLICY qa_executions_update_mod
  ON public.qa_executions FOR UPDATE TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS qa_executions_delete_mod ON public.qa_executions;
CREATE POLICY qa_executions_delete_mod
  ON public.qa_executions FOR DELETE TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_execution_comments_select_mod ON public.qa_execution_comments;
CREATE POLICY qa_execution_comments_select_mod
  ON public.qa_execution_comments FOR SELECT TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS qa_execution_comments_insert_mod ON public.qa_execution_comments;
CREATE POLICY qa_execution_comments_insert_mod
  ON public.qa_execution_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator() AND author_id = auth.uid());

DROP POLICY IF EXISTS qa_execution_comments_delete_mod ON public.qa_execution_comments;
CREATE POLICY qa_execution_comments_delete_mod
  ON public.qa_execution_comments FOR DELETE TO authenticated
  USING (public.is_moderator() AND author_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_test_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_execution_comments TO authenticated;
