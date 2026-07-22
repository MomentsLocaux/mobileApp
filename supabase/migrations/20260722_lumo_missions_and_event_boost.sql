-- MVP-LUMO-005 + MVP-LUMO-006
-- Missions progress/claim + event boost activation & ranking signal.
-- Gated by is_gamification_enabled(). Apply DEV with human OK; UAT/prod separately.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS period_key text;

ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS steps_done jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.active_boosts
  ADD COLUMN IF NOT EXISTS target_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS active_boosts_target_active_idx
  ON public.active_boosts (target_id, expires_at)
  WHERE target_id IS NOT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS boosted_until timestamptz;

CREATE INDEX IF NOT EXISTS events_boosted_until_idx
  ON public.events (boosted_until DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- Period helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mission_period_key(p_kind text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_kind, ''))
    WHEN 'daily' THEN to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM-DD')
    WHEN 'weekly' THEN to_char((now() AT TIME ZONE 'utc')::date, 'IYYY-"W"IW')
    ELSE to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM-DD')
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_mission(p_user_id uuid, p_mission_id uuid)
RETURNS public.user_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission public.missions%ROWTYPE;
  v_period text;
  v_row public.user_missions%ROWTYPE;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RAISE EXCEPTION 'MISSION_NOT_FOUND';
  END IF;

  v_period := public.mission_period_key(v_mission.kind);

  SELECT * INTO v_row
  FROM public.user_missions
  WHERE mission_id = p_mission_id AND user_id = p_user_id;

  IF v_row.id IS NULL THEN
    INSERT INTO public.user_missions (
      mission_id, user_id, progress, completed, completed_at, period_key, steps_done
    )
    VALUES (p_mission_id, p_user_id, 0, false, NULL, v_period, '[]'::jsonb)
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF coalesce(v_row.period_key, '') <> v_period THEN
    UPDATE public.user_missions
    SET progress = 0,
        completed = false,
        completed_at = NULL,
        period_key = v_period,
        steps_done = '[]'::jsonb
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_mission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_mission(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Core progress (works for auth user or explicit user_id from service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_mission_progress_core(p_user_id uuid, p_step text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission record;
  v_um public.user_missions%ROWTYPE;
  v_unique_steps boolean;
  v_already boolean;
  v_trigger text;
  v_idem text;
  v_credit json;
  v_results jsonb := '[]'::jsonb;
  v_advanced boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER';
  END IF;
  IF p_step IS NULL OR length(trim(p_step)) = 0 THEN
    RAISE EXCEPTION 'INVALID_STEP';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object('success', true, 'skipped', true, 'reason', 'GAMIFICATION_DISABLED');
  END IF;

  FOR v_mission IN
    SELECT m.*
    FROM public.missions m
    WHERE m.metadata->>'adr' = 'ADR_004'
      AND m.start_at <= now()
      AND m.end_at >= now()
      AND (m.metadata -> 'steps') ? p_step
  LOOP
    v_um := public.ensure_user_mission(p_user_id, v_mission.id);
    IF v_um.completed THEN
      CONTINUE;
    END IF;

    v_advanced := false;

    -- Unique-step recipes (daily: favorite_event + open_event_detail): count each step once.
    SELECT
      (SELECT count(*) FROM jsonb_array_elements_text(coalesce(v_mission.metadata->'steps','[]'::jsonb))) =
      (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(coalesce(v_mission.metadata->'steps','[]'::jsonb)))
    INTO v_unique_steps;

    IF v_unique_steps AND p_step <> 'checkin' THEN
      SELECT coalesce(v_um.steps_done, '[]'::jsonb) ? p_step INTO v_already;
      IF NOT v_already THEN
        UPDATE public.user_missions
        SET steps_done = coalesce(steps_done, '[]'::jsonb) || jsonb_build_array(p_step),
            progress = least(progress + 1, v_mission.target)
        WHERE id = v_um.id
        RETURNING * INTO v_um;
        v_advanced := true;
      END IF;
    ELSE
      -- Repeatable steps (weekly checkins)
      UPDATE public.user_missions
      SET progress = least(progress + 1, v_mission.target)
      WHERE id = v_um.id
        AND completed = false
      RETURNING * INTO v_um;
      v_advanced := FOUND;
    END IF;

    IF v_um.progress >= v_mission.target AND NOT v_um.completed THEN
      UPDATE public.user_missions
      SET completed = true, completed_at = now()
      WHERE id = v_um.id
      RETURNING * INTO v_um;

      v_trigger := coalesce(
        nullif(v_mission.metadata->>'lumo_rule_code', ''),
        CASE v_mission.kind
          WHEN 'daily' THEN 'mission_daily'
          WHEN 'weekly' THEN 'mission_weekly'
          ELSE v_mission.kind
        END
      );

      v_idem := 'mission_complete:' || p_user_id::text || ':' || v_mission.id::text || ':' || coalesce(v_um.period_key, '');
      v_credit := public.credit_lumo_by_rule(
        p_user_id,
        v_trigger,
        v_idem,
        jsonb_build_object('mission_id', v_mission.id, 'kind', v_mission.kind)
      );

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'mission_id', v_mission.id,
        'completed', true,
        'progress', v_um.progress,
        'target', v_mission.target,
        'credit', v_credit
      ));
    ELSIF v_advanced THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'mission_id', v_mission.id,
        'completed', false,
        'progress', v_um.progress,
        'target', v_mission.target
      ));
    END IF;
  END LOOP;

  RETURN json_build_object('success', true, 'updates', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.record_mission_progress_core(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_mission_progress_core(uuid, text) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.record_mission_progress(p_step text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  RETURN public.record_mission_progress_core(v_user_id, p_step);
END;
$$;

REVOKE ALL ON FUNCTION public.record_mission_progress(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_mission_progress(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_missions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mission record;
  v_um public.user_missions%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  FOR v_mission IN
    SELECT m.*
    FROM public.missions m
    WHERE m.metadata->>'adr' = 'ADR_004'
      AND m.start_at <= now()
      AND m.end_at >= now()
    ORDER BY m.kind, m.title
  LOOP
    v_um := public.ensure_user_mission(v_user_id, v_mission.id);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'mission_id', v_mission.id,
      'title', v_mission.title,
      'description', v_mission.description,
      'kind', v_mission.kind,
      'target', v_mission.target,
      'reward_lumo', v_mission.reward_lumo,
      'steps', coalesce(v_mission.metadata -> 'steps', '[]'::jsonb),
      'progress', v_um.progress,
      'completed', v_um.completed,
      'completed_at', v_um.completed_at,
      'period_key', v_um.period_key,
      'steps_done', coalesce(v_um.steps_done, '[]'::jsonb)
    ));
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'gamification_enabled', public.is_gamification_enabled(),
    'missions', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_missions() TO authenticated;

-- Favorite → daily step (never fails the favorite)
CREATE OR REPLACE FUNCTION public.toggle_favorite(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  DELETE FROM public.favorites
  WHERE profile_id = v_user_id
    AND favorites.event_id = toggle_favorite.event_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN FALSE;
  END IF;

  BEGIN
    INSERT INTO public.favorites (profile_id, event_id)
    VALUES (v_user_id, toggle_favorite.event_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM public.record_mission_progress_core(v_user_id, 'favorite_event');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Event boost purchase + ranking signal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_event_boost(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_price integer;
  v_hours integer;
  v_creator uuid;
  v_boost_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  SELECT creator_id INTO v_creator FROM public.events WHERE id = p_event_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_creator <> v_user_id THEN
    RAISE EXCEPTION 'NOT_EVENT_OWNER';
  END IF;

  SELECT id, price, coalesce((data->>'duration_hours')::integer, 24)
  INTO v_item_id, v_price, v_hours
  FROM public.shop_items
  WHERE key = 'event_boost_24h';

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.active_boosts
    WHERE target_id = p_event_id AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'BOOST_ALREADY_ACTIVE';
  END IF;

  PERFORM public.spend_lumo(
    v_price,
    'event_boost',
    v_item_id,
    jsonb_build_object('event_id', p_event_id)
  );

  v_expires := now() + make_interval(hours => v_hours);

  INSERT INTO public.active_boosts (user_id, item_id, target_id, started_at, expires_at)
  VALUES (v_user_id, v_item_id, p_event_id, now(), v_expires)
  RETURNING id INTO v_boost_id;

  UPDATE public.events
  SET boosted_until = v_expires
  WHERE id = p_event_id;

  RETURN json_build_object(
    'success', true,
    'boost_id', v_boost_id,
    'event_id', p_event_id,
    'expires_at', v_expires,
    'price', v_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_event_boost(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_event_boost(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_expired_boosts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id, user_id, item_id, target_id
    FROM public.active_boosts
    WHERE expires_at < now()
  LOOP
    BEGIN
      PERFORM public.deliver_user_notification(
        rec.user_id,
        'boost_expired',
        'Boost expiré',
        'Votre boost est arrivé à expiration.',
        jsonb_build_object('boostId', rec.id, 'itemId', rec.item_id, 'eventId', rec.target_id),
        'rewards'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    DELETE FROM public.active_boosts WHERE id = rec.id;

    IF rec.target_id IS NOT NULL THEN
      UPDATE public.events e
      SET boosted_until = NULL
      WHERE e.id = rec.target_id
        AND NOT EXISTS (
          SELECT 1 FROM public.active_boosts b
          WHERE b.target_id = e.id AND b.expires_at > now()
        );
    END IF;
  END LOOP;
END;
$$;
