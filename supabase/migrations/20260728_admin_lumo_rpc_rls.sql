-- ADMIN-LUMO-001 — Moderator RLS/RPCs for partners, Pass redemption, gamification config,
-- and safe Lumo credit from the web console (anon key + is_moderator()).
-- Depends on: 20260727_lumo_earned_boost_and_partner_pass.sql
-- Apply DEV with human OK; UAT/prod separately. Do NOT apply without validation.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers: allowlisted gamification app_config keys (never expose push URL, etc.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_gamification_config_key(p_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_key IN (
    'gamification_enabled',
    'partner_pass_enabled',
    'partner_pass_redemption_enabled',
    'creator_boost_min_checkins'
  );
$$;

REVOKE ALL ON FUNCTION public.is_gamification_config_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gamification_config_key(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- partners / partner_rewards — moderator write (SELECT already allows inactive for mods)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_rewards TO authenticated;

DROP POLICY IF EXISTS partners_insert_moderator ON public.partners;
CREATE POLICY partners_insert_moderator
  ON public.partners
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS partners_update_moderator ON public.partners;
CREATE POLICY partners_update_moderator
  ON public.partners
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS partners_delete_moderator ON public.partners;
CREATE POLICY partners_delete_moderator
  ON public.partners
  FOR DELETE
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS partner_rewards_insert_moderator ON public.partner_rewards;
CREATE POLICY partner_rewards_insert_moderator
  ON public.partner_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS partner_rewards_update_moderator ON public.partner_rewards;
CREATE POLICY partner_rewards_update_moderator
  ON public.partner_rewards
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS partner_rewards_delete_moderator ON public.partner_rewards;
CREATE POLICY partner_rewards_delete_moderator
  ON public.partner_rewards
  FOR DELETE
  TO authenticated
  USING (public.is_moderator());

-- ---------------------------------------------------------------------------
-- user_partner_passes / user_pass_progress — moderator SELECT (list + support)
-- Writes for redemption go through admin_redeem_partner_pass (SECURITY DEFINER).
-- ---------------------------------------------------------------------------
GRANT SELECT ON TABLE public.user_partner_passes TO authenticated;
GRANT SELECT ON TABLE public.user_pass_progress TO authenticated;

DROP POLICY IF EXISTS user_partner_passes_select_moderator ON public.user_partner_passes;
CREATE POLICY user_partner_passes_select_moderator
  ON public.user_partner_passes
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS user_pass_progress_select_moderator ON public.user_pass_progress;
CREATE POLICY user_pass_progress_select_moderator
  ON public.user_pass_progress
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

-- ---------------------------------------------------------------------------
-- Support reads (ADMIN-LUMO-008 readiness): wallets, ledger, boost credits, rules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wallets_select_moderator ON public.wallets;
CREATE POLICY wallets_select_moderator
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS lumo_transactions_select_moderator ON public.lumo_transactions;
CREATE POLICY lumo_transactions_select_moderator
  ON public.lumo_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS creator_boost_credits_select_moderator ON public.creator_boost_credits;
CREATE POLICY creator_boost_credits_select_moderator
  ON public.creator_boost_credits
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS lumo_rules_select_moderator ON public.lumo_rules;
CREATE POLICY lumo_rules_select_moderator
  ON public.lumo_rules
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS lumo_rules_update_moderator ON public.lumo_rules;
CREATE POLICY lumo_rules_update_moderator
  ON public.lumo_rules
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

GRANT SELECT, UPDATE ON TABLE public.lumo_rules TO authenticated;
GRANT SELECT ON TABLE public.creator_boost_credits TO authenticated;

-- ---------------------------------------------------------------------------
-- app_config — whitelist only (never supabase_project_url or other ops keys)
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON TABLE public.app_config TO authenticated;

DROP POLICY IF EXISTS app_config_select_gamification_moderator ON public.app_config;
CREATE POLICY app_config_select_gamification_moderator
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (public.is_moderator() AND public.is_gamification_config_key(key));

DROP POLICY IF EXISTS app_config_update_gamification_moderator ON public.app_config;
CREATE POLICY app_config_update_gamification_moderator
  ON public.app_config
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator() AND public.is_gamification_config_key(key))
  WITH CHECK (public.is_moderator() AND public.is_gamification_config_key(key));

-- ---------------------------------------------------------------------------
-- admin_redeem_partner_pass — resolve by redemption_code (ops desk / partner desk)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_redeem_partner_pass(
  p_redemption_code text,
  p_partner_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.user_partner_passes%ROWTYPE;
  v_code text := lower(trim(coalesce(p_redemption_code, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_MODERATOR';
  END IF;

  IF NOT public.is_partner_pass_redemption_enabled() THEN
    RAISE EXCEPTION 'PARTNER_PASS_NOT_LIVE';
  END IF;

  IF length(v_code) = 0 THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  SELECT * INTO v_pass
  FROM public.user_partner_passes
  WHERE lower(redemption_code) = v_code
  FOR UPDATE;

  IF v_pass.id IS NULL THEN
    RAISE EXCEPTION 'PASS_NOT_FOUND';
  END IF;

  IF v_pass.status = 'redeemed' THEN
    RETURN json_build_object(
      'ok', true,
      'idempotent', true,
      'pass_id', v_pass.id,
      'user_id', v_pass.user_id,
      'status', v_pass.status,
      'redeemed_at', v_pass.redeemed_at
    );
  END IF;

  IF v_pass.status <> 'available' THEN
    RAISE EXCEPTION 'PASS_NOT_AVAILABLE'
      USING DETAIL = format('status=%s', v_pass.status);
  END IF;

  UPDATE public.user_partner_passes
  SET status = 'redeemed',
      redeemed_at = now()
  WHERE id = v_pass.id
  RETURNING * INTO v_pass;

  RETURN json_build_object(
    'ok', true,
    'pass_id', v_pass.id,
    'user_id', v_pass.user_id,
    'period_key', v_pass.period_key,
    'status', v_pass.status,
    'redeemed_at', v_pass.redeemed_at,
    'partner_note', p_partner_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_redeem_partner_pass(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_redeem_partner_pass(text, text) TO authenticated, service_role;

-- Lookup helper for console (code → pass + profile fields via join in client)
CREATE OR REPLACE FUNCTION public.admin_lookup_partner_pass(p_redemption_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.user_partner_passes%ROWTYPE;
  v_code text := lower(trim(coalesce(p_redemption_code, '')));
  v_display text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_MODERATOR';
  END IF;

  IF length(v_code) = 0 THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  SELECT * INTO v_pass
  FROM public.user_partner_passes
  WHERE lower(redemption_code) = v_code
  LIMIT 1;

  IF v_pass.id IS NULL THEN
    RETURN json_build_object('ok', true, 'found', false);
  END IF;

  SELECT p.display_name INTO v_display
  FROM public.profiles p
  WHERE p.id = v_pass.user_id;

  RETURN json_build_object(
    'ok', true,
    'found', true,
    'pass', json_build_object(
      'id', v_pass.id,
      'user_id', v_pass.user_id,
      'display_name', v_display,
      'reward_id', v_pass.reward_id,
      'period_key', v_pass.period_key,
      'status', v_pass.status,
      'redemption_code', v_pass.redemption_code,
      'redeemed_at', v_pass.redeemed_at,
      'created_at', v_pass.created_at
    ),
    'redemption_live', public.is_partner_pass_redemption_enabled()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_lookup_partner_pass(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lookup_partner_pass(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- moderator_credit_lumo_by_rule — allowlisted triggers only (event/media approve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderator_credit_lumo_by_rule(
  p_user_id uuid,
  p_trigger_event text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger text := lower(trim(coalesce(p_trigger_event, '')));
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_MODERATOR';
  END IF;

  IF v_trigger NOT IN ('event_published_approved', 'media_approved') THEN
    RAISE EXCEPTION 'TRIGGER_NOT_ALLOWED'
      USING HINT = 'Only event_published_approved and media_approved';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  v_meta := v_meta || jsonb_build_object(
    'credited_by', auth.uid(),
    'credited_via', 'moderator_credit_lumo_by_rule'
  );

  v_result := public.credit_lumo_by_rule(
    p_user_id,
    v_trigger,
    trim(p_idempotency_key),
    v_meta
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.moderator_credit_lumo_by_rule(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderator_credit_lumo_by_rule(uuid, text, text, jsonb) TO authenticated, service_role;

-- Keep direct credit_lumo_by_rule locked to service_role (unchanged).

COMMIT;
