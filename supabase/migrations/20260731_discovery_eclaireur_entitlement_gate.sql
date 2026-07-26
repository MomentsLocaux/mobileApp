-- Gate Discovery push fan-out on Éclaireur entitlement (moments_locaux_plus).
-- Prefs UI alone is not enough: non-Éclaireur must not receive discovery_* pushes.

CREATE OR REPLACE FUNCTION public.user_has_active_entitlement(
  p_user_id uuid,
  p_entitlement text DEFAULT 'moments_locaux_plus'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
      AND us.entitlement = p_entitlement
      AND us.status IN ('active', 'grace_period', 'trialing')
      AND (us.expires_at IS NULL OR us.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_active_entitlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_active_entitlement(uuid, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.discovery_enqueue_right_now_pushes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      er.user_id,
      er.id AS recommendation_id,
      er.event_id,
      e.title AS event_title,
      er.valid_until
    FROM public.event_recommendations er
    JOIN public.events e ON e.id = er.event_id
    JOIN public.discovery_consents dc
      ON dc.user_id = er.user_id
     AND dc.enabled = true
     AND dc.personalization_enabled = true
    JOIN public.user_preferences up ON up.user_id = er.user_id
    WHERE er.recommendation_type = 'right_now'
      AND er.valid_until > now()
      AND er.dismissed_at IS NULL
      AND e.starts_at > now()
      AND e.starts_at <= now() + interval '3 hours'
      AND coalesce(up.push_enabled, true) = true
      AND coalesce(up.discovery_push_enabled, false) = true
      AND coalesce(up.right_now_push_enabled, false) = true
      AND public.user_has_active_entitlement(er.user_id, 'moments_locaux_plus')
  ),
  weekly_counts AS (
    SELECT n.user_id, COUNT(*) AS sent_count
    FROM public.notifications n
    WHERE n.type::text LIKE 'discovery_%'
      AND n.created_at > now() - interval '7 days'
    GROUP BY n.user_id
  ),
  eligible AS (
    SELECT c.*
    FROM candidates c
    JOIN public.user_preferences up ON up.user_id = c.user_id
    LEFT JOIN weekly_counts wc ON wc.user_id = c.user_id
    WHERE coalesce(wc.sent_count, 0) < coalesce(up.discovery_max_push_per_week, 3)
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = c.user_id
          AND n.type = 'discovery_right_now'
          AND n.created_at > now() - interval '6 hours'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = c.user_id
          AND n.type = 'discovery_right_now'
          AND n.data->>'recommendationId' = c.recommendation_id::text
      )
  )
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    e.user_id,
    'discovery_right_now',
    'Une idée pour maintenant',
    e.event_title,
    jsonb_build_object(
      'recommendationId', e.recommendation_id,
      'eventId', e.event_id,
      'source', 'discovery_enqueue_right_now_pushes_v2_eclaireur'
    )
  FROM eligible e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.discovery_enqueue_break_loop_pushes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      er.user_id,
      er.id AS recommendation_id,
      er.event_id,
      e.title AS event_title
    FROM public.event_recommendations er
    JOIN public.events e ON e.id = er.event_id
    JOIN public.discovery_consents dc
      ON dc.user_id = er.user_id
     AND dc.enabled = true
     AND dc.personalization_enabled = true
    JOIN public.user_preferences up ON up.user_id = er.user_id
    WHERE er.recommendation_type = 'break_the_loop'
      AND er.valid_until > now()
      AND er.dismissed_at IS NULL
      AND e.starts_at > now()
      AND coalesce(up.push_enabled, true) = true
      AND coalesce(up.discovery_push_enabled, false) = true
      AND coalesce(up.break_loop_push_enabled, false) = true
      AND public.user_has_active_entitlement(er.user_id, 'moments_locaux_plus')
  ),
  eligible AS (
    SELECT c.*
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = c.user_id
        AND n.type = 'discovery_break_loop'
        AND n.data->>'recommendationId' = c.recommendation_id::text
    )
  )
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    e.user_id,
    'discovery_break_loop',
    'Sortez de la routine',
    e.event_title,
    jsonb_build_object(
      'recommendationId', e.recommendation_id,
      'eventId', e.event_id,
      'source', 'discovery_enqueue_break_loop_pushes_v2_eclaireur'
    )
  FROM eligible e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.discovery_enqueue_life_insight_pushes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH eligible AS (
    SELECT di.id AS insight_id, di.user_id, di.title, di.body
    FROM public.discovery_insights di
    JOIN public.discovery_consents dc
      ON dc.user_id = di.user_id
     AND dc.enabled = true
     AND dc.personalization_enabled = true
    JOIN public.user_preferences up ON up.user_id = di.user_id
    WHERE di.valid_until > now()
      AND di.seen_at IS NULL
      AND coalesce(up.push_enabled, true) = true
      AND coalesce(up.discovery_push_enabled, false) = true
      AND coalesce(up.life_insight_push_enabled, false) = true
      AND public.user_has_active_entitlement(di.user_id, 'moments_locaux_plus')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = di.user_id
          AND n.type = 'discovery_life_insight'
          AND n.data->>'insightId' = di.id::text
      )
  )
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    e.user_id,
    'discovery_life_insight',
    coalesce(nullif(btrim(e.title), ''), 'Un conseil pour vous'),
    e.body,
    jsonb_build_object(
      'insightId', e.insight_id,
      'source', 'discovery_enqueue_life_insight_pushes_v2_eclaireur'
    )
  FROM eligible e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.discovery_enqueue_personal_match_pushes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      er.user_id,
      er.id AS recommendation_id,
      er.event_id,
      e.title AS event_title
    FROM public.event_recommendations er
    JOIN public.events e ON e.id = er.event_id
    JOIN public.discovery_consents dc
      ON dc.user_id = er.user_id
     AND dc.enabled = true
     AND dc.personalization_enabled = true
    JOIN public.user_preferences up ON up.user_id = er.user_id
    WHERE er.recommendation_type = 'for_you'
      AND er.valid_until > now()
      AND er.dismissed_at IS NULL
      AND e.starts_at > now()
      AND e.starts_at <= now() + interval '7 days'
      AND coalesce(up.push_enabled, true) = true
      AND coalesce(up.discovery_push_enabled, false) = true
      AND public.user_has_active_entitlement(er.user_id, 'moments_locaux_plus')
  ),
  weekly_counts AS (
    SELECT n.user_id, COUNT(*) AS sent_count
    FROM public.notifications n
    WHERE n.type::text LIKE 'discovery_%'
      AND n.created_at > now() - interval '7 days'
    GROUP BY n.user_id
  ),
  daily_counts AS (
    SELECT
      n.user_id,
      COUNT(*) AS sent_count
    FROM public.notifications n
    WHERE n.created_at >= (
      date_trunc('day', timezone('Europe/Paris', now()))
      AT TIME ZONE 'Europe/Paris'
    )
    GROUP BY n.user_id
  ),
  eligible AS (
    SELECT c.*
    FROM candidates c
    JOIN public.user_preferences up ON up.user_id = c.user_id
    LEFT JOIN weekly_counts wc ON wc.user_id = c.user_id
    LEFT JOIN daily_counts dc ON dc.user_id = c.user_id
    WHERE coalesce(wc.sent_count, 0) < coalesce(up.discovery_max_push_per_week, 3)
      AND (
        coalesce(up.max_push_per_day, 3) = 0
        OR coalesce(dc.sent_count, 0) < coalesce(up.max_push_per_day, 3)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = c.user_id
          AND n.type = 'discovery_personal_match'
          AND n.created_at > now() - interval '24 hours'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = c.user_id
          AND n.type = 'discovery_personal_match'
          AND n.data->>'recommendationId' = c.recommendation_id::text
      )
  )
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    e.user_id,
    'discovery_personal_match',
    'Un moment pour toi',
    e.event_title,
    jsonb_build_object(
      'recommendationId', e.recommendation_id,
      'eventId', e.event_id,
      'source', 'discovery_enqueue_personal_match_pushes_v2_eclaireur'
    )
  FROM eligible e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
