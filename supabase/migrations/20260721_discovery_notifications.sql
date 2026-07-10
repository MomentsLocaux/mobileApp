-- DISC-P1-004: Discovery notification types + opportunity push cron.
-- Do NOT apply to production without human validation.

BEGIN;

ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_right_now';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_break_loop';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_new_area';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_personal_match';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_life_insight';

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
      'source', 'discovery_enqueue_right_now_pushes_v1'
    )
  FROM eligible e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_enqueue_right_now_pushes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_enqueue_right_now_pushes() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-push-opportunities') THEN
    PERFORM cron.unschedule('discovery-push-opportunities');
  END IF;
END $$;

SELECT cron.schedule(
  'discovery-push-opportunities',
  '*/30 * * * *',
  $$SELECT public.discovery_enqueue_right_now_pushes();$$
);

COMMIT;
