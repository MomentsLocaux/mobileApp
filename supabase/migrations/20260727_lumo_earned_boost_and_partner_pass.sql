-- MVP-LUMO-010 — Boost créateur gagné après N check-ins (M4)
-- MVP-LUMO-008 — Pass partenaire / streak (schéma + progression ; redemption gated)
-- Gated by is_gamification_enabled(). Apply DEV with human OK.

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
INSERT INTO public.app_config (key, value)
VALUES
  ('creator_boost_min_checkins', '5'),
  ('partner_pass_enabled', 'true'),
  ('partner_pass_redemption_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- LUMO-010: earned boost credits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_boost_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unused'
    CHECK (status IN ('unused', 'used')),
  used_on_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE (source_event_id)
);

CREATE INDEX IF NOT EXISTS creator_boost_credits_user_unused_idx
  ON public.creator_boost_credits (user_id, created_at DESC)
  WHERE status = 'unused';

ALTER TABLE public.creator_boost_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_boost_credits_select_own ON public.creator_boost_credits;
CREATE POLICY creator_boost_credits_select_own
  ON public.creator_boost_credits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.creator_boost_credits FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.creator_boost_credits TO authenticated;
GRANT ALL ON TABLE public.creator_boost_credits TO service_role;

CREATE OR REPLACE FUNCTION public.creator_boost_threshold()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT greatest(
    1,
    coalesce(
      nullif(trim((SELECT value FROM public.app_config WHERE key = 'creator_boost_min_checkins')), '')::integer,
      5
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.award_earned_boost_for_event(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_checkins integer := 0;
  v_threshold integer := public.creator_boost_threshold();
  v_credit_id uuid;
BEGIN
  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'GAMIFICATION_DISABLED');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'EVENT_NOT_FOUND');
  END IF;
  IF v_event.creator_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'NO_CREATOR');
  END IF;
  IF v_event.status IS DISTINCT FROM 'published' THEN
    RETURN json_build_object('ok', false, 'reason', 'NOT_PUBLISHED');
  END IF;
  IF v_event.ends_at IS NULL OR v_event.ends_at > now() THEN
    RETURN json_build_object('ok', false, 'reason', 'EVENT_NOT_ENDED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.creator_boost_credits c WHERE c.source_event_id = p_event_id
  ) THEN
    RETURN json_build_object('ok', true, 'already', true, 'event_id', p_event_id);
  END IF;

  SELECT count(*)::integer INTO v_checkins
  FROM public.event_checkins
  WHERE event_id = p_event_id;

  IF v_checkins < v_threshold THEN
    RETURN json_build_object(
      'ok', true,
      'eligible', false,
      'checkins', v_checkins,
      'threshold', v_threshold
    );
  END IF;

  INSERT INTO public.creator_boost_credits (user_id, source_event_id, status)
  VALUES (v_event.creator_id, p_event_id, 'unused')
  RETURNING id INTO v_credit_id;

  BEGIN
    PERFORM public.deliver_user_notification(
      v_event.creator_id,
      'lumo_reward',
      'Boost gagné',
      format('Ton événement a atteint %s check-ins. Tu as gagné un boost 24h.', v_checkins),
      jsonb_build_object(
        'eventId', p_event_id,
        'creditId', v_credit_id,
        'checkins', v_checkins,
        'kind', 'earned_boost'
      ),
      'rewards'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object(
    'ok', true,
    'awarded', true,
    'credit_id', v_credit_id,
    'user_id', v_event.creator_id,
    'checkins', v_checkins,
    'threshold', v_threshold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_earned_boost_for_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_earned_boost_for_event(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.award_earned_creator_boosts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_awarded integer := 0;
  v_result json;
BEGIN
  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'GAMIFICATION_DISABLED');
  END IF;

  FOR rec IN
    SELECT e.id
    FROM public.events e
    WHERE e.status = 'published'
      AND e.ends_at IS NOT NULL
      AND e.ends_at <= now()
      AND e.ends_at >= (now() - interval '14 days')
      AND e.creator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.creator_boost_credits c WHERE c.source_event_id = e.id
      )
  LOOP
    v_result := public.award_earned_boost_for_event(rec.id);
    IF coalesce((v_result->>'awarded')::boolean, false) THEN
      v_awarded := v_awarded + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('ok', true, 'awarded', v_awarded);
END;
$$;

REVOKE ALL ON FUNCTION public.award_earned_creator_boosts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_earned_creator_boosts() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_earned_boosts()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_unused integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object('ok', true, 'gamification_enabled', false, 'unused', 0, 'credits', '[]'::json);
  END IF;

  SELECT count(*)::integer INTO v_unused
  FROM public.creator_boost_credits
  WHERE user_id = v_user AND status = 'unused';

  RETURN json_build_object(
    'ok', true,
    'gamification_enabled', true,
    'unused', v_unused,
    'threshold', public.creator_boost_threshold(),
    'credits', coalesce((
      SELECT json_agg(json_build_object(
        'id', c.id,
        'source_event_id', c.source_event_id,
        'status', c.status,
        'used_on_event_id', c.used_on_event_id,
        'created_at', c.created_at,
        'used_at', c.used_at
      ) ORDER BY c.created_at DESC)
      FROM public.creator_boost_credits c
      WHERE c.user_id = v_user
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_earned_boosts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_earned_boosts() TO authenticated;

CREATE OR REPLACE FUNCTION public.use_earned_event_boost(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_creator uuid;
  v_credit_id uuid;
  v_item_id uuid;
  v_hours integer := 24;
  v_boost_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  SELECT creator_id INTO v_creator FROM public.events WHERE id = p_event_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_creator <> v_user THEN
    RAISE EXCEPTION 'NOT_EVENT_OWNER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.active_boosts
    WHERE target_id = p_event_id AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'BOOST_ALREADY_ACTIVE';
  END IF;

  SELECT id INTO v_credit_id
  FROM public.creator_boost_credits
  WHERE user_id = v_user AND status = 'unused'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit_id IS NULL THEN
    RAISE EXCEPTION 'NO_EARNED_BOOST';
  END IF;

  SELECT id, coalesce((data->>'duration_hours')::integer, 24)
  INTO v_item_id, v_hours
  FROM public.shop_items
  WHERE key = 'event_boost_24h';

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  v_expires := now() + make_interval(hours => v_hours);

  UPDATE public.creator_boost_credits
  SET status = 'used',
      used_on_event_id = p_event_id,
      used_at = now()
  WHERE id = v_credit_id;

  INSERT INTO public.active_boosts (user_id, item_id, target_id, started_at, expires_at)
  VALUES (v_user, v_item_id, p_event_id, now(), v_expires)
  RETURNING id INTO v_boost_id;

  UPDATE public.events
  SET boosted_until = v_expires
  WHERE id = p_event_id;

  RETURN json_build_object(
    'success', true,
    'earned', true,
    'boost_id', v_boost_id,
    'credit_id', v_credit_id,
    'event_id', p_event_id,
    'expires_at', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.use_earned_event_boost(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_earned_event_boost(uuid) TO authenticated;

-- Cron hourly (idempotent schedule name)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'award-earned-creator-boosts';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'award-earned-creator-boosts',
  '20 * * * *',
  $$SELECT public.award_earned_creator_boosts();$$
);

-- ---------------------------------------------------------------------------
-- LUMO-008: partners / pass / streak (redemption off by default)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  description text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  stamps_required integer NOT NULL DEFAULT 3 CHECK (stamps_required > 0),
  active boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_pass_progress (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  checkins_count integer NOT NULL DEFAULT 0 CHECK (checkins_count >= 0),
  streak_unlocked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_partner_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.partner_rewards(id) ON DELETE SET NULL,
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'redeemed', 'expired', 'pending_partner')),
  redemption_code text UNIQUE,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_key)
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pass_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_partner_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partners_select_auth ON public.partners;
CREATE POLICY partners_select_auth
  ON public.partners FOR SELECT TO authenticated
  USING (active = true OR public.is_moderator());

DROP POLICY IF EXISTS partner_rewards_select_auth ON public.partner_rewards;
CREATE POLICY partner_rewards_select_auth
  ON public.partner_rewards FOR SELECT TO authenticated
  USING (active = true OR public.is_moderator());

DROP POLICY IF EXISTS user_pass_progress_select_own ON public.user_pass_progress;
CREATE POLICY user_pass_progress_select_own
  ON public.user_pass_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_partner_passes_select_own ON public.user_partner_passes;
CREATE POLICY user_partner_passes_select_own
  ON public.user_partner_passes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.partners FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.partner_rewards FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.user_pass_progress FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.user_partner_passes FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.partners TO authenticated;
GRANT SELECT ON TABLE public.partner_rewards TO authenticated;
GRANT SELECT ON TABLE public.user_pass_progress TO authenticated;
GRANT SELECT ON TABLE public.user_partner_passes TO authenticated;
GRANT ALL ON TABLE public.partners TO service_role;
GRANT ALL ON TABLE public.partner_rewards TO service_role;
GRANT ALL ON TABLE public.user_pass_progress TO service_role;
GRANT ALL ON TABLE public.user_partner_passes TO service_role;

-- Placeholder partner (inactive) for UX copy
INSERT INTO public.partners (id, name, city, description, active)
VALUES (
  '44444444-5555-6666-8777-888888888881',
  'Partenaire pilote (à venir)',
  NULL,
  'Les Pass IRL seront activés ville par ville avec des commerces partenaires.',
  false
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pass_period_key()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION public.is_partner_pass_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT lower(trim(value)) IN ('1', 'true', 'yes', 'on')
     FROM public.app_config WHERE key = 'partner_pass_enabled'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_partner_pass_redemption_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT lower(trim(value)) IN ('1', 'true', 'yes', 'on')
     FROM public.app_config WHERE key = 'partner_pass_redemption_enabled'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.record_pass_progress_core(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := public.pass_period_key();
  v_period_start timestamptz;
  v_count integer := 0;
  v_unlocked boolean := false;
  v_pass_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'MISSING_USER');
  END IF;

  IF NOT public.is_gamification_enabled() OR NOT public.is_partner_pass_enabled() THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'PASS_DISABLED');
  END IF;

  v_period_start := date_trunc('month', (now() AT TIME ZONE 'utc')) AT TIME ZONE 'utc';

  SELECT count(DISTINCT c.event_id)::integer INTO v_count
  FROM public.event_checkins c
  WHERE c.user_id = p_user_id
    AND c.created_at >= v_period_start;

  v_unlocked := v_count >= 3;

  INSERT INTO public.user_pass_progress AS p (user_id, period_key, checkins_count, streak_unlocked, updated_at)
  VALUES (p_user_id, v_period, v_count, v_unlocked, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    period_key = EXCLUDED.period_key,
    checkins_count = EXCLUDED.checkins_count,
    streak_unlocked = EXCLUDED.streak_unlocked,
    updated_at = now();

  IF v_unlocked THEN
    INSERT INTO public.user_partner_passes (user_id, reward_id, period_key, status, redemption_code)
    VALUES (
      p_user_id,
      NULL,
      v_period,
      CASE
        WHEN public.is_partner_pass_redemption_enabled() THEN 'available'
        ELSE 'pending_partner'
      END,
      encode(gen_random_bytes(8), 'hex')
    )
    ON CONFLICT (user_id, period_key) DO NOTHING
    RETURNING id INTO v_pass_id;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'period_key', v_period,
    'checkins_count', v_count,
    'streak_unlocked', v_unlocked,
    'pass_id', v_pass_id,
    'redemption_live', public.is_partner_pass_redemption_enabled()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_pass_progress_core(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pass_progress_core(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_pass_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_progress public.user_pass_progress%ROWTYPE;
  v_pass public.user_partner_passes%ROWTYPE;
  v_period text := public.pass_period_key();
  v_refresh json;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() OR NOT public.is_partner_pass_enabled() THEN
    RETURN json_build_object(
      'ok', true,
      'enabled', false,
      'message', 'Pass partenaire bientôt disponible.'
    );
  END IF;

  v_refresh := public.record_pass_progress_core(v_user);

  SELECT * INTO v_progress FROM public.user_pass_progress WHERE user_id = v_user;
  SELECT * INTO v_pass
  FROM public.user_partner_passes
  WHERE user_id = v_user AND period_key = v_period
  LIMIT 1;

  RETURN json_build_object(
    'ok', true,
    'enabled', true,
    'redemption_live', public.is_partner_pass_redemption_enabled(),
    'period_key', v_period,
    'checkins_count', coalesce(v_progress.checkins_count, 0),
    'stamps_required', 3,
    'streak_unlocked', coalesce(v_progress.streak_unlocked, false),
    'pass', CASE
      WHEN v_pass.id IS NULL THEN NULL
      ELSE json_build_object(
        'id', v_pass.id,
        'status', v_pass.status,
        'redemption_code', CASE
          WHEN public.is_partner_pass_redemption_enabled() THEN v_pass.redemption_code
          ELSE NULL
        END,
        'created_at', v_pass.created_at
      )
    END,
    'message', CASE
      WHEN public.is_partner_pass_redemption_enabled() THEN
        'Présente ton Pass chez un partenaire pilote.'
      ELSE
        'Bientôt : échange ton Pass chez des commerces partenaires locaux. Continue à sortir pour garder ton streak.'
    END
  );
END;
$$;

-- Allow authenticated to refresh own progress via get (record_pass_progress_core is service_role only,
-- so wrap a self-call path inside get using SECURITY DEFINER — already does).
-- Also grant authenticated a thin wrapper for check-in edge if needed:
CREATE OR REPLACE FUNCTION public.record_my_pass_progress()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  RETURN public.record_pass_progress_core(v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_pass_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pass_status() TO authenticated;
REVOKE ALL ON FUNCTION public.record_my_pass_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_pass_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pass_progress_core(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_partner_pass(p_pass_id uuid, p_partner_code text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pass public.user_partner_passes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_partner_pass_redemption_enabled() THEN
    RAISE EXCEPTION 'PARTNER_PASS_NOT_LIVE';
  END IF;

  SELECT * INTO v_pass
  FROM public.user_partner_passes
  WHERE id = p_pass_id AND user_id = v_user
  FOR UPDATE;

  IF v_pass.id IS NULL THEN
    RAISE EXCEPTION 'PASS_NOT_FOUND';
  END IF;
  IF v_pass.status <> 'available' THEN
    RAISE EXCEPTION 'PASS_NOT_AVAILABLE';
  END IF;

  UPDATE public.user_partner_passes
  SET status = 'redeemed',
      redeemed_at = now()
  WHERE id = p_pass_id;

  RETURN json_build_object(
    'ok', true,
    'pass_id', p_pass_id,
    'partner_code', p_partner_code,
    'redeemed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_partner_pass(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_partner_pass(uuid, text) TO authenticated;
