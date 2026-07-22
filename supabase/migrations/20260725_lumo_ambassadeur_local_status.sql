-- MVP-LUMO-007 — Statut quartier / badge Ambassadeur (palier Habitué, pas une couche).
-- Score mensuel UTC localisé par profiles.city. Gated by is_gamification_enabled().

-- ---------------------------------------------------------------------------
-- Badge catalog
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS badges_code_uidx ON public.badges (code);

INSERT INTO public.badges (id, code, title, description, icon_url, criteria)
VALUES (
  '33333333-4444-5555-8666-777777777774',
  'ambassadeur-quartier',
  'Ambassadeur',
  'Habitué engagé de ton quartier — présence et contributions locales.',
  NULL,
  '{"tier":"ambassadeur","period":"monthly"}'::jsonb
)
ON CONFLICT (code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria;

-- ---------------------------------------------------------------------------
-- Status table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_local_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  city text,
  period_key text NOT NULL,
  checkins_count integer NOT NULL DEFAULT 0 CHECK (checkins_count >= 0),
  events_held_count integer NOT NULL DEFAULT 0 CHECK (events_held_count >= 0),
  contributions_count integer NOT NULL DEFAULT 0 CHECK (contributions_count >= 0),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  tier text NOT NULL DEFAULT 'local'
    CHECK (tier IN ('local', 'habitue', 'ambassadeur')),
  is_ambassadeur boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_local_status_city_tier_idx
  ON public.user_local_status (city, tier)
  WHERE is_ambassadeur = true;

CREATE INDEX IF NOT EXISTS user_local_status_period_idx
  ON public.user_local_status (period_key);

ALTER TABLE public.user_local_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_local_status_select_auth ON public.user_local_status;
CREATE POLICY user_local_status_select_auth
  ON public.user_local_status
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.user_local_status FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.user_local_status TO authenticated;
GRANT ALL ON TABLE public.user_local_status TO service_role;

-- Allow reading awarded badges (no client writes)
DROP POLICY IF EXISTS user_badges_select_auth ON public.user_badges;
CREATE POLICY user_badges_select_auth
  ON public.user_badges
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS badges_select_auth ON public.badges;
CREATE POLICY badges_select_auth
  ON public.badges
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.local_status_period_key()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION public.local_status_tier(p_score integer, p_checkins integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_score >= 100 AND p_checkins >= 5 THEN 'ambassadeur'
    WHEN p_score >= 40 OR p_checkins >= 2 THEN 'habitue'
    ELSE 'local'
  END;
$$;

-- ---------------------------------------------------------------------------
-- Refresh (server-owned score)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_user_local_status(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := public.local_status_period_key();
  v_period_start timestamptz;
  v_city text;
  v_checkins integer := 0;
  v_events_held integer := 0;
  v_contrib integer := 0;
  v_score integer := 0;
  v_tier text := 'local';
  v_badge_id uuid;
  v_caller uuid := auth.uid();
  v_is_service boolean := (coalesce(auth.role(), '') = 'service_role');
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'MISSING_USER');
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT v_is_service THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'GAMIFICATION_DISABLED');
  END IF;

  v_period_start := date_trunc('month', (now() AT TIME ZONE 'utc')) AT TIME ZONE 'utc';

  SELECT nullif(trim(p.city), '') INTO v_city
  FROM public.profiles p
  WHERE p.id = p_user_id;

  SELECT count(*)::integer INTO v_checkins
  FROM public.event_checkins c
  JOIN public.events e ON e.id = c.event_id
  WHERE c.user_id = p_user_id
    AND c.created_at >= v_period_start
    AND (
      v_city IS NULL
      OR e.city IS NULL
      OR lower(e.city) = lower(v_city)
    );

  SELECT count(*)::integer INTO v_events_held
  FROM public.events e
  WHERE e.creator_id = p_user_id
    AND e.status = 'published'
    AND e.starts_at >= v_period_start
    AND e.starts_at < (v_period_start + interval '1 month')
    AND (
      v_city IS NULL
      OR e.city IS NULL
      OR lower(e.city) = lower(v_city)
    );

  SELECT count(*)::integer INTO v_contrib
  FROM public.event_comments ec
  JOIN public.events e ON e.id = ec.event_id
  WHERE ec.author_id = p_user_id
    AND ec.parent_comment_id IS NULL
    AND ec.created_at >= v_period_start
    AND (
      v_city IS NULL
      OR e.city IS NULL
      OR lower(e.city) = lower(v_city)
    );

  v_score := (v_checkins * 10) + (v_events_held * 40) + (v_contrib * 15);
  v_tier := public.local_status_tier(v_score, v_checkins);

  INSERT INTO public.user_local_status AS s (
    user_id, city, period_key, checkins_count, events_held_count, contributions_count,
    score, tier, is_ambassadeur, computed_at, updated_at
  )
  VALUES (
    p_user_id, v_city, v_period, v_checkins, v_events_held, v_contrib,
    v_score, v_tier, (v_tier = 'ambassadeur'), now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    city = EXCLUDED.city,
    period_key = EXCLUDED.period_key,
    checkins_count = EXCLUDED.checkins_count,
    events_held_count = EXCLUDED.events_held_count,
    contributions_count = EXCLUDED.contributions_count,
    score = EXCLUDED.score,
    tier = EXCLUDED.tier,
    is_ambassadeur = EXCLUDED.is_ambassadeur,
    computed_at = EXCLUDED.computed_at,
    updated_at = now();

  SELECT id INTO v_badge_id FROM public.badges WHERE code = 'ambassadeur-quartier' LIMIT 1;

  IF v_badge_id IS NOT NULL THEN
    IF v_tier = 'ambassadeur' THEN
      INSERT INTO public.user_badges (badge_id, user_id, awarded_at)
      VALUES (v_badge_id, p_user_id, now())
      ON CONFLICT (badge_id, user_id) DO NOTHING;
    ELSE
      DELETE FROM public.user_badges
      WHERE badge_id = v_badge_id AND user_id = p_user_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'user_id', p_user_id,
    'city', v_city,
    'period_key', v_period,
    'checkins_count', v_checkins,
    'events_held_count', v_events_held,
    'contributions_count', v_contrib,
    'score', v_score,
    'tier', v_tier,
    'is_ambassadeur', v_tier = 'ambassadeur'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_user_local_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_user_local_status(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public read (no lumo_total)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_local_status(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_row public.user_local_status%ROWTYPE;
  v_period text := public.local_status_period_key();
  v_refresh json;
BEGIN
  IF v_user IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'UNAUTHENTICATED');
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RETURN json_build_object(
      'ok', true,
      'gamification_enabled', false,
      'user_id', v_user,
      'is_ambassadeur', false,
      'tier', 'local'
    );
  END IF;

  SELECT * INTO v_row FROM public.user_local_status WHERE user_id = v_user;

  IF (
    v_row.user_id IS NULL
    OR coalesce(v_row.period_key, '') <> v_period
    OR v_row.computed_at < (now() - interval '6 hours')
  )
  AND (
    auth.uid() = v_user
    OR coalesce(auth.role(), '') = 'service_role'
  ) THEN
    v_refresh := public.refresh_user_local_status(v_user);
    IF (v_refresh->>'skipped') = 'true' THEN
      RETURN json_build_object(
        'ok', true,
        'gamification_enabled', false,
        'user_id', v_user,
        'is_ambassadeur', false,
        'tier', 'local'
      );
    END IF;
    SELECT * INTO v_row FROM public.user_local_status WHERE user_id = v_user;
  END IF;

  IF v_row.user_id IS NULL THEN
    RETURN json_build_object(
      'ok', true,
      'gamification_enabled', true,
      'user_id', v_user,
      'is_ambassadeur', false,
      'tier', 'local',
      'period_key', v_period
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'gamification_enabled', true,
    'user_id', v_row.user_id,
    'city', v_row.city,
    'period_key', v_row.period_key,
    'checkins_count', v_row.checkins_count,
    'events_held_count', v_row.events_held_count,
    'contributions_count', v_row.contributions_count,
    'score', v_row.score,
    'tier', v_row.tier,
    'is_ambassadeur', v_row.is_ambassadeur,
    'computed_at', v_row.computed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_local_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_local_status(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Expose badge flag on community_profile_stats (not lumo when unused)
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
  COALESCE(uls.tier, 'local') AS local_tier
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
    local_tier
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
    (s.events_created_count * 40)::numeric + s.lumo_month * 0.5 + (s.followers_count * 10)::numeric AS score
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
    (s.events_created_count * 40)::numeric + s.lumo_month * 0.5 + (s.followers_count * 10)::numeric AS score
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
    (s.events_created_count * 40)::numeric + s.lumo_total * 0.5 + (s.followers_count * 10)::numeric AS score
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
