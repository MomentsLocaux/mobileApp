-- PUSH-P0-001 / PUSH-P0-002 / PUSH-P1-001
-- Preference center push enforcement helpers + nearby theme filter + personal_match enqueue.
--
-- Depends on: 20260729_preference_center_budget_quiet_themes.sql,
--             20260722_notifications_delivery_hardening.sql,
--             20260721_discovery_notifications.sql
-- Do NOT apply to production without human validation.

BEGIN;

-- ---------------------------------------------------------------------------
-- PUSH-P0-001: count notifications created "today" in Europe/Paris
-- Used by push-dispatch for max_push_per_day (includes current insert).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_user_notifications_today(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.created_at >= (
      date_trunc('day', timezone('Europe/Paris', now()))
      AT TIME ZONE 'Europe/Paris'
    );
$$;

COMMENT ON FUNCTION public.count_user_notifications_today(uuid) IS
  'PUSH-P0-001: inbox rows created today (Europe/Paris). Edge push-dispatch skips OS push when count > max_push_per_day.';

REVOKE ALL ON FUNCTION public.count_user_notifications_today(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_user_notifications_today(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- PUSH-P0-002: soft theme filter on nearby fan-out
-- Empty preferred_category_slugs = no filter (legacy behaviour).
-- NULL event.category = do not exclude (avoid silence).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_event_published_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_became_published boolean;
BEGIN
    v_became_published :=
        new.status = 'published'
        AND (tg_op = 'INSERT' OR old.status IS DISTINCT FROM 'published');

    IF NOT v_became_published THEN
        RETURN new;
    END IF;

    IF coalesce(new.visibility, 'public') = 'private' THEN
        RETURN new;
    END IF;

    IF new.creator_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT
            f.follower,
            'followed_creator_published',
            coalesce(pr.display_name, 'Un créateur') || ' a publié un événement',
            new.title,
            jsonb_build_object('eventId', new.id, 'creatorId', new.creator_id)
        FROM public.follows f
        LEFT JOIN public.user_preferences up ON up.user_id = f.follower
        LEFT JOIN public.profiles pr ON pr.id = new.creator_id
        WHERE f.following = new.creator_id
          AND f.follower <> new.creator_id
          AND coalesce(up.notify_followed_creator, true) = true
          AND coalesce(up.notify_frequency, 'instant') = 'instant'
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = f.follower
                AND n.type = 'followed_creator_published'
                AND n.data->>'eventId' = new.id::text
          );

        INSERT INTO public.notification_digest_queue (
            user_id, notification_type, title, body, data, digest_period
        )
        SELECT
            f.follower,
            'followed_creator_published',
            coalesce(pr.display_name, 'Un créateur') || ' a publié un événement',
            new.title,
            jsonb_build_object('eventId', new.id, 'creatorId', new.creator_id),
            up.notify_frequency
        FROM public.follows f
        JOIN public.user_preferences up ON up.user_id = f.follower
        LEFT JOIN public.profiles pr ON pr.id = new.creator_id
        WHERE f.following = new.creator_id
          AND f.follower <> new.creator_id
          AND coalesce(up.notify_followed_creator, true) = true
          AND coalesce(up.notify_frequency, 'instant') IN ('daily', 'weekly')
          AND NOT EXISTS (
              SELECT 1 FROM public.notification_digest_queue q
              WHERE q.user_id = f.follower
                AND q.notification_type = 'followed_creator_published'
                AND q.data->>'eventId' = new.id::text
          );
    END IF;

    IF new.location IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT
            up.user_id,
            'event_nearby_new',
            'Nouvel événement près de chez vous',
            new.title,
            jsonb_build_object('eventId', new.id, 'city', new.city)
        FROM public.user_preferences up
        WHERE up.home_location IS NOT NULL
          AND coalesce(up.notify_event_nearby, true) = true
          AND coalesce(up.notify_frequency, 'instant') = 'instant'
          AND (new.creator_id IS NULL OR up.user_id <> new.creator_id)
          AND st_dwithin(up.home_location, new.location, coalesce(up.notify_radius_km, 25) * 1000)
          AND (
              cardinality(coalesce(up.preferred_category_slugs, '{}'::text[])) = 0
              OR new.category IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM public.event_category ec
                  WHERE ec.id = new.category
                    AND ec.slug = ANY (up.preferred_category_slugs)
              )
          )
          AND (
              new.creator_id IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM public.follows f
                  WHERE f.following = new.creator_id AND f.follower = up.user_id
              )
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = up.user_id
                AND n.type = 'event_nearby_new'
                AND n.data->>'eventId' = new.id::text
          );

        INSERT INTO public.notification_digest_queue (
            user_id, notification_type, title, body, data, digest_period
        )
        SELECT
            up.user_id,
            'event_nearby_new',
            'Nouvel événement près de chez vous',
            new.title,
            jsonb_build_object('eventId', new.id, 'city', new.city),
            up.notify_frequency
        FROM public.user_preferences up
        WHERE up.home_location IS NOT NULL
          AND coalesce(up.notify_event_nearby, true) = true
          AND coalesce(up.notify_frequency, 'instant') IN ('daily', 'weekly')
          AND (new.creator_id IS NULL OR up.user_id <> new.creator_id)
          AND st_dwithin(up.home_location, new.location, coalesce(up.notify_radius_km, 25) * 1000)
          AND (
              cardinality(coalesce(up.preferred_category_slugs, '{}'::text[])) = 0
              OR new.category IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM public.event_category ec
                  WHERE ec.id = new.category
                    AND ec.slug = ANY (up.preferred_category_slugs)
              )
          )
          AND (
              new.creator_id IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM public.follows f
                  WHERE f.following = new.creator_id AND f.follower = up.user_id
              )
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.notification_digest_queue q
              WHERE q.user_id = up.user_id
                AND q.notification_type = 'event_nearby_new'
                AND q.data->>'eventId' = new.id::text
          );
    END IF;

    RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- PUSH-P1-001: enqueue discovery_personal_match from for_you recommendations
-- ---------------------------------------------------------------------------
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
      'source', 'discovery_enqueue_personal_match_pushes_v1'
    )
  FROM eligible e;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_enqueue_personal_match_pushes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_enqueue_personal_match_pushes() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-push-opportunities') THEN
    PERFORM cron.unschedule('discovery-push-opportunities');
  END IF;
END $$;

SELECT cron.schedule(
  'discovery-push-opportunities',
  '*/30 * * * *',
  $$
  SELECT public.discovery_enqueue_right_now_pushes();
  SELECT public.discovery_enqueue_break_loop_pushes();
  SELECT public.discovery_enqueue_personal_match_pushes();
  $$
);

COMMIT;
