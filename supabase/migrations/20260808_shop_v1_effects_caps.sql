-- SHOP-V1 effects: boost 24/72h, community highlight 7d, pass extra stamp + caps.
-- Also restores boosted_until cleanup on boost expiry (regressed in notifications hardening).
-- Target: moments-locaux-dev after validation. Do not apply UAT/prod without human OK.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_highlighted_until timestamptz;

CREATE INDEX IF NOT EXISTS profiles_community_highlighted_until_idx
  ON public.profiles (community_highlighted_until DESC NULLS LAST)
  WHERE community_highlighted_until IS NOT NULL;

ALTER TABLE public.user_pass_progress
  ADD COLUMN IF NOT EXISTS bonus_stamps integer NOT NULL DEFAULT 0;

ALTER TABLE public.user_pass_progress
  ADD COLUMN IF NOT EXISTS bonus_period_key text;

COMMENT ON COLUMN public.profiles.community_highlighted_until IS
  'SHOP-V1 community_highlight_7d — mise en avant feed/cercle jusqu’à cette date';
COMMENT ON COLUMN public.user_pass_progress.bonus_stamps IS
  'SHOP-V1 pass_extra_stamp — tampons bonus Lumo (cap 1/mois), hors check-ins réels';

-- Annotate duration on 24h item if missing
UPDATE public.shop_items
SET data = coalesce(data, '{}'::jsonb) || '{"duration_hours":24,"requires_can_create":true,"rayon":"visibility"}'::jsonb
WHERE key = 'event_boost_24h'
  AND coalesce((data->>'duration_hours')::integer, 0) = 0;

-- ---------------------------------------------------------------------------
-- Pass progress: include bonus stamps toward unlock
-- ---------------------------------------------------------------------------
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
  v_bonus integer := 0;
  v_effective integer := 0;
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

  SELECT CASE
    WHEN p.bonus_period_key IS DISTINCT FROM v_period THEN 0
    ELSE coalesce(p.bonus_stamps, 0)
  END INTO v_bonus
  FROM public.user_pass_progress p
  WHERE p.user_id = p_user_id;

  v_bonus := coalesce(v_bonus, 0);
  v_effective := v_count + v_bonus;
  v_unlocked := v_effective >= 3;

  INSERT INTO public.user_pass_progress AS p (
    user_id, period_key, checkins_count, streak_unlocked, updated_at,
    bonus_stamps, bonus_period_key
  )
  VALUES (
    p_user_id, v_period, v_count, v_unlocked, now(),
    v_bonus, v_period
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    period_key = EXCLUDED.period_key,
    checkins_count = EXCLUDED.checkins_count,
    streak_unlocked = EXCLUDED.streak_unlocked,
    updated_at = now(),
    bonus_stamps = CASE
      WHEN public.user_pass_progress.bonus_period_key IS DISTINCT FROM v_period
        THEN 0
      ELSE public.user_pass_progress.bonus_stamps
    END,
    bonus_period_key = v_period;

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
    'bonus_stamps', v_bonus,
    'effective_stamps', v_effective,
    'streak_unlocked', v_unlocked,
    'pass_id', v_pass_id,
    'redemption_live', public.is_partner_pass_redemption_enabled()
  );
END;
$$;

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
  v_bonus integer := 0;
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

  v_bonus := CASE
    WHEN v_progress.bonus_period_key IS DISTINCT FROM v_period THEN 0
    ELSE coalesce(v_progress.bonus_stamps, 0)
  END;

  RETURN json_build_object(
    'ok', true,
    'enabled', true,
    'redemption_live', public.is_partner_pass_redemption_enabled(),
    'period_key', v_period,
    'checkins_count', coalesce(v_progress.checkins_count, 0) + v_bonus,
    'checkins_raw', coalesce(v_progress.checkins_count, 0),
    'bonus_stamps', v_bonus,
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

-- ---------------------------------------------------------------------------
-- Boost purchase: 24h / 72h item key + cap 2 actifs / user
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.purchase_event_boost(uuid);

CREATE OR REPLACE FUNCTION public.purchase_event_boost(
  p_event_id uuid,
  p_item_key text DEFAULT 'event_boost_24h'
)
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
  v_key text := coalesce(nullif(trim(p_item_key), ''), 'event_boost_24h');
  v_active_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  IF v_key NOT IN ('event_boost_24h', 'event_boost_72h') THEN
    RAISE EXCEPTION 'INVALID_BOOST_ITEM';
  END IF;

  SELECT creator_id INTO v_creator FROM public.events WHERE id = p_event_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_creator <> v_user_id THEN
    RAISE EXCEPTION 'NOT_EVENT_OWNER';
  END IF;

  SELECT id, price, coalesce((data->>'duration_hours')::integer, CASE WHEN v_key = 'event_boost_72h' THEN 72 ELSE 24 END)
  INTO v_item_id, v_price, v_hours
  FROM public.shop_items
  WHERE key = v_key;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.active_boosts
    WHERE target_id = p_event_id AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'BOOST_ALREADY_ACTIVE';
  END IF;

  SELECT count(*)::integer INTO v_active_count
  FROM public.active_boosts
  WHERE user_id = v_user_id
    AND expires_at > now()
    AND target_id IS NOT NULL;

  IF v_active_count >= 2 THEN
    RAISE EXCEPTION 'BOOST_CAP_REACHED';
  END IF;

  PERFORM public.spend_lumo(
    v_price,
    'event_boost',
    v_item_id,
    jsonb_build_object('event_id', p_event_id, 'item_key', v_key, 'duration_hours', v_hours)
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
    'item_key', v_key,
    'duration_hours', v_hours,
    'expires_at', v_expires,
    'price', v_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_event_boost(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_event_boost(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- buy_item: apply highlight + pass stamp effects (inventory for skins only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buy_item(p_item_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_price integer;
  v_type text;
  v_data jsonb;
  v_effect text;
  v_qty integer := 0;
  v_days integer;
  v_expires timestamptz;
  v_period text;
  v_bonus integer;
  v_result json;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  SELECT id, price, type, coalesce(data, '{}'::jsonb)
  INTO v_item_id, v_price, v_type, v_data
  FROM public.shop_items
  WHERE key = p_item_key;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  v_effect := coalesce(v_data->>'effect', '');

  -- Event boosts must use purchase_event_boost (event-scoped)
  IF v_effect = 'event_visibility_boost' OR p_item_key LIKE 'event_boost_%' THEN
    RAISE EXCEPTION 'USE_PURCHASE_EVENT_BOOST';
  END IF;

  IF v_effect = 'early_access_unlock' THEN
    RAISE EXCEPTION 'USE_PURCHASE_EARLY_ACCESS';
  END IF;

  -- Cap: 1 pass_extra_stamp / calendar month
  IF v_effect = 'pass_extra_stamp' THEN
    v_period := public.pass_period_key();
    IF EXISTS (
      SELECT 1
      FROM public.lumo_transactions t
      WHERE t.user_id = v_user_id
        AND t.type = 'debit'
        AND t.created_at >= date_trunc('month', (now() AT TIME ZONE 'utc')) AT TIME ZONE 'utc'
        AND (
          t.metadata->>'item_key' = 'pass_extra_stamp'
          OR t.metadata->>'effect' = 'pass_extra_stamp'
        )
    ) THEN
      RAISE EXCEPTION 'PASS_STAMP_CAP_REACHED';
    END IF;
  END IF;

  PERFORM public.spend_lumo(
    v_price,
    'shop_purchase',
    v_item_id,
    jsonb_build_object('item_key', p_item_key, 'effect', v_effect)
  );

  IF v_effect = 'community_highlight' THEN
    v_days := coalesce((v_data->>'duration_days')::integer, 7);
    v_expires := now() + make_interval(days => v_days);

    UPDATE public.profiles
    SET community_highlighted_until = GREATEST(
      coalesce(community_highlighted_until, now()),
      v_expires
    )
    WHERE id = v_user_id;

    INSERT INTO public.active_boosts (user_id, item_id, target_id, started_at, expires_at)
    VALUES (v_user_id, v_item_id, NULL, now(), v_expires);

    v_result := json_build_object(
      'success', true,
      'item_id', v_item_id,
      'effect', 'community_highlight',
      'expires_at', v_expires
    );

  ELSIF v_effect = 'pass_extra_stamp' THEN
    v_period := public.pass_period_key();

    INSERT INTO public.user_pass_progress AS p (
      user_id, period_key, checkins_count, streak_unlocked, updated_at,
      bonus_stamps, bonus_period_key
    )
    VALUES (v_user_id, v_period, 0, false, now(), 1, v_period)
    ON CONFLICT (user_id) DO UPDATE
    SET
      bonus_stamps = CASE
        WHEN public.user_pass_progress.bonus_period_key IS DISTINCT FROM v_period THEN 1
        ELSE public.user_pass_progress.bonus_stamps + 1
      END,
      bonus_period_key = v_period,
      updated_at = now();

    PERFORM public.record_pass_progress_core(v_user_id);

    SELECT CASE
      WHEN bonus_period_key IS DISTINCT FROM v_period THEN 0
      ELSE bonus_stamps
    END INTO v_bonus
    FROM public.user_pass_progress
    WHERE user_id = v_user_id;

    v_result := json_build_object(
      'success', true,
      'item_id', v_item_id,
      'effect', 'pass_extra_stamp',
      'bonus_stamps', coalesce(v_bonus, 1)
    );

  ELSE
    -- Skins / inventory items
    INSERT INTO public.user_inventory (user_id, item_id, quantity)
    VALUES (v_user_id, v_item_id, 1)
    ON CONFLICT (user_id, item_id) DO
      UPDATE SET quantity = public.user_inventory.quantity + 1,
                 acquired_at = now()
      WHERE public.user_inventory.user_id = v_user_id
        AND public.user_inventory.item_id = v_item_id;

    SELECT quantity INTO v_qty
    FROM public.user_inventory
    WHERE user_id = v_user_id AND item_id = v_item_id;

    v_result := json_build_object(
      'success', true,
      'item_id', v_item_id,
      'quantity', v_qty,
      'effect', v_effect
    );
  END IF;

  PERFORM public.deliver_user_notification(
    v_user_id,
    'lumo_reward',
    'Achat confirmé',
    'Merci pour votre achat dans la boutique.',
    jsonb_build_object('itemId', v_item_id, 'price', v_price, 'itemKey', p_item_key),
    'rewards'
  );

  PERFORM public.log_activity(
    v_user_id,
    'purchase',
    v_item_id,
    jsonb_build_object('price', v_price, 'item_key', p_item_key)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.buy_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_item(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Expiry: clear event boost signal + community highlight
-- ---------------------------------------------------------------------------
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
    ELSE
      -- Profile-level highlight: clear if no other active null-target boost remains
      UPDATE public.profiles p
      SET community_highlighted_until = NULL
      WHERE p.id = rec.user_id
        AND coalesce(p.community_highlighted_until, now()) <= now()
        AND NOT EXISTS (
          SELECT 1
          FROM public.active_boosts b
          JOIN public.shop_items si ON si.id = b.item_id
          WHERE b.user_id = p.id
            AND b.target_id IS NULL
            AND b.expires_at > now()
            AND coalesce(si.data->>'effect', '') = 'community_highlight'
        );
    END IF;
  END LOOP;

  -- Safety sweep for profiles whose highlight expired without matching boost row
  UPDATE public.profiles
  SET community_highlighted_until = NULL
  WHERE community_highlighted_until IS NOT NULL
    AND community_highlighted_until < now();
END;
$$;

-- ---------------------------------------------------------------------------
-- Community stats: expose highlight for feed ranking
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.community_leaderboard;
DROP VIEW IF EXISTS public.community_profile_stats;

CREATE OR REPLACE VIEW public.community_profile_stats
WITH (security_invoker = true)
AS
WITH lumo_agg AS (
  SELECT
    user_id,
    SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS lumo_total,
    SUM(
      CASE
        WHEN type = 'credit' AND created_at >= date_trunc('month', now()) THEN amount
        ELSE 0
      END
    ) AS lumo_month
  FROM public.lumo_transactions
  GROUP BY user_id
),
event_counts AS (
  SELECT creator_id AS user_id, COUNT(*) AS events_created_count
  FROM public.events
  GROUP BY creator_id
),
follow_counts AS (
  SELECT following AS user_id, COUNT(*) AS followers_count
  FROM public.follows
  GROUP BY following
),
following_counts AS (
  SELECT follower AS user_id, COUNT(*) AS following_count
  FROM public.follows
  GROUP BY follower
)
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  p.cover_url,
  p.city,
  p.bio,
  COALESCE(ec.events_created_count, 0) AS events_created_count,
  COALESCE(lu.lumo_total, 0) AS lumo_total,
  COALESCE(lu.lumo_month, 0) AS lumo_month,
  COALESCE(fc.followers_count, 0) AS followers_count,
  COALESCE(fgc.following_count, 0) AS following_count,
  COALESCE(uls.is_ambassadeur, false) AS is_ambassadeur,
  COALESCE(uls.tier, 'local') AS local_tier,
  (p.community_highlighted_until IS NOT NULL AND p.community_highlighted_until > now()) AS is_community_highlighted,
  p.community_highlighted_until
FROM public.profiles p
LEFT JOIN event_counts ec ON ec.user_id = p.id
LEFT JOIN lumo_agg lu ON lu.user_id = p.id
LEFT JOIN follow_counts fc ON fc.user_id = p.id
LEFT JOIN following_counts fgc ON fgc.user_id = p.id
LEFT JOIN public.user_local_status uls ON uls.user_id = p.id;

CREATE OR REPLACE VIEW public.community_leaderboard
WITH (security_invoker = true)
AS
WITH stats AS (
  SELECT
    user_id,
    display_name,
    avatar_url,
    cover_url,
    city,
    events_created_count,
    followers_count,
    lumo_total,
    lumo_month,
    is_ambassadeur,
    local_tier,
    is_community_highlighted
  FROM public.community_profile_stats
),
base AS (
  SELECT
    'monthly'::text AS period,
    NULL::text AS city_partition,
    s.user_id,
    s.display_name,
    s.avatar_url,
    s.cover_url,
    s.city AS user_city,
    s.events_created_count,
    s.followers_count,
    s.lumo_total,
    s.lumo_month,
    s.is_ambassadeur,
    s.local_tier,
    (s.events_created_count * 40)::numeric
      + s.lumo_month * 0.5
      + (s.followers_count * 10)::numeric
      + CASE WHEN s.is_community_highlighted THEN 200 ELSE 0 END AS score
  FROM stats s
  UNION ALL
  SELECT
    'monthly'::text AS period,
    s.city AS city_partition,
    s.user_id,
    s.display_name,
    s.avatar_url,
    s.cover_url,
    s.city AS user_city,
    s.events_created_count,
    s.followers_count,
    s.lumo_total,
    s.lumo_month,
    s.is_ambassadeur,
    s.local_tier,
    (s.events_created_count * 40)::numeric
      + s.lumo_month * 0.5
      + (s.followers_count * 10)::numeric
      + CASE WHEN s.is_community_highlighted THEN 200 ELSE 0 END AS score
  FROM stats s
  WHERE s.city IS NOT NULL AND s.city <> ''
  UNION ALL
  SELECT
    'global'::text AS period,
    NULL::text AS city_partition,
    s.user_id,
    s.display_name,
    s.avatar_url,
    s.cover_url,
    s.city AS user_city,
    s.events_created_count,
    s.followers_count,
    s.lumo_total,
    s.lumo_month,
    s.is_ambassadeur,
    s.local_tier,
    (s.events_created_count * 40)::numeric
      + s.lumo_total * 0.5
      + (s.followers_count * 10)::numeric
      + CASE WHEN s.is_community_highlighted THEN 200 ELSE 0 END AS score
  FROM stats s
),
ranked AS (
  SELECT
    period,
    city_partition AS city,
    user_id,
    display_name,
    avatar_url,
    cover_url,
    user_city,
    events_created_count,
    followers_count,
    lumo_total,
    lumo_month,
    is_ambassadeur,
    local_tier,
    score,
    rank() OVER (
      PARTITION BY period, city_partition
      ORDER BY score DESC, events_created_count DESC, followers_count DESC, user_id
    ) AS rank
  FROM base
)
SELECT
  period,
  city,
  user_id,
  display_name,
  avatar_url,
  cover_url,
  user_city,
  events_created_count,
  followers_count,
  lumo_total,
  lumo_month,
  score,
  rank,
  is_ambassadeur,
  local_tier
FROM ranked;

GRANT SELECT ON public.community_profile_stats TO authenticated;
GRANT SELECT ON public.community_leaderboard TO authenticated;
