-- DISC-P1-007: Extend activity_log for discovery analytics (optional P1).
-- Safe when activity_log already exists in production.
-- Do NOT apply to production without human validation.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.activity_log') IS NULL THEN
    RAISE NOTICE 'activity_log missing — skipping DISC-P1-007 migration';
    RETURN;
  END IF;

  ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_check;

  ALTER TABLE public.activity_log
    ADD CONSTRAINT activity_log_action_check
    CHECK (
      action IN (
        'like',
        'view_event',
        'follow',
        'mission_completed',
        'purchase',
        'search',
        'view_recommendation',
        'dismiss_recommendation',
        'open_recommendation',
        'route_requested',
        'share_event',
        'premium_paywall_view',
        'premium_trial_started',
        'premium_subscribed'
      )
    );

  ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS activity_log_insert_own ON public.activity_log;
  CREATE POLICY activity_log_insert_own
    ON public.activity_log
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS activity_log_select_own ON public.activity_log;
  CREATE POLICY activity_log_select_own
    ON public.activity_log
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.log_activity(
      p_action text,
      p_metadata jsonb DEFAULT '{}'::jsonb
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_user_id uuid := auth.uid();
      v_row public.activity_log%ROWTYPE;
    BEGIN
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
      END IF;

      INSERT INTO public.activity_log (user_id, action, metadata)
      VALUES (v_user_id, p_action, COALESCE(p_metadata, '{}'::jsonb))
      RETURNING * INTO v_row;

      RETURN to_jsonb(v_row);
    END;
    $body$;
  $fn$;

  EXECUTE 'REVOKE ALL ON FUNCTION public.log_activity(text, jsonb) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_activity(text, jsonb) TO authenticated, service_role';
END $$;

COMMIT;
