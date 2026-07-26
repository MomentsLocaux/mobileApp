-- PUSH-P0-003: live proximity alerts (approach ≠ publish-time nearby)
--
-- Distinct from notify_event_nearby (home_location fan-out at publish time)
-- and from Discovery capture (visit clustering).
--
-- Do not apply without human validation (AGENTS.md).

-- ---------------------------------------------------------------------------
-- 1) Enum + preference
-- ---------------------------------------------------------------------------
ALTER TYPE public.notification_type_mod_enum
  ADD VALUE IF NOT EXISTS 'event_nearby_live';

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_proximity_live boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_preferences.notify_proximity_live IS
  'PUSH-P0-003: opt-in for approach alerts when the device is near a live/soon event. Default off. Requires OS background location on the client.';

-- ---------------------------------------------------------------------------
-- 2) Pref gate on deliver_user_notification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deliver_user_notification(
    p_user_id uuid,
    p_type public.notification_type_mod_enum,
    p_title text,
    p_body text,
    p_data jsonb,
    p_pref_gate text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_freq text;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN;
    END IF;

    SELECT coalesce(up.notify_frequency, 'instant')
    INTO v_freq
    FROM public.user_preferences up
    WHERE up.user_id = p_user_id;

    IF NOT FOUND THEN
        v_freq := 'instant';
    END IF;

    IF p_pref_gate = 'social' THEN
        IF coalesce((
            SELECT up.notify_social FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'rewards' THEN
        IF coalesce((
            SELECT up.notify_rewards FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'event_nearby' THEN
        IF coalesce((
            SELECT up.notify_event_nearby FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'event_reminders' THEN
        IF coalesce((
            SELECT up.notify_event_reminders FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'followed_creator' THEN
        IF coalesce((
            SELECT up.notify_followed_creator FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), true) = false THEN
            RETURN;
        END IF;
    ELSIF p_pref_gate = 'proximity_live' THEN
        IF coalesce((
            SELECT up.notify_proximity_live FROM public.user_preferences up WHERE up.user_id = p_user_id
        ), false) = false THEN
            RETURN;
        END IF;
    END IF;

    IF v_freq IN ('daily', 'weekly')
       AND p_type IN ('event_nearby_new', 'followed_creator_published') THEN
        INSERT INTO public.notification_digest_queue (
            user_id, notification_type, title, body, data, digest_period
        ) VALUES (
            p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb), v_freq
        );
        RETURN;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_user_notification(
    uuid, public.notification_type_mod_enum, text, text, jsonb, text
) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3) Client-callable report: device position → at most a few live/soon alerts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_proximity_live_alerts(
  p_lat double precision,
  p_lon double precision,
  p_radius_m double precision DEFAULT 500,
  p_soon_hours integer DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_radius_m double precision;
  v_soon_hours integer;
  v_count integer := 0;
  r record;
  v_title text;
  v_body text;
  v_phase text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lon < -180 OR p_lon > 180 THEN
    RETURN 0;
  END IF;

  IF coalesce((
    SELECT up.notify_proximity_live
    FROM public.user_preferences up
    WHERE up.user_id = v_uid
  ), false) IS NOT TRUE THEN
    RETURN 0;
  END IF;

  v_radius_m := GREATEST(100.0, LEAST(COALESCE(p_radius_m, 500.0), 2000.0));
  v_soon_hours := GREATEST(1, LEAST(COALESCE(p_soon_hours, 3), 12));

  FOR r IN
    WITH user_point AS (
      SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography AS geog
    ),
    prefs AS (
      SELECT coalesce(up.preferred_category_slugs, '{}'::text[]) AS themes
      FROM public.user_preferences up
      WHERE up.user_id = v_uid
    ),
    candidates AS (
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.ends_at,
        CASE
          WHEN e.starts_at <= now()
            AND coalesce(e.ends_at, e.starts_at + interval '6 hours') >= now()
            THEN 'live'
          ELSE 'soon'
        END AS phase,
        (ST_Distance(event_geog.geog, user_point.geog))::double precision AS distance_m
      FROM public.events e
      CROSS JOIN user_point
      LEFT JOIN prefs ON true
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          e.location,
          CASE
            WHEN e.latitude IS NOT NULL AND e.longitude IS NOT NULL
              THEN ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography
            ELSE NULL
          END
        ) AS geog
      ) event_geog
      WHERE e.status = 'published'
        AND e.visibility = 'public'
        AND event_geog.geog IS NOT NULL
        AND ST_DWithin(event_geog.geog, user_point.geog, v_radius_m)
        AND (
          (
            e.starts_at <= now()
            AND coalesce(e.ends_at, e.starts_at + interval '6 hours') >= now()
          )
          OR (
            e.starts_at > now()
            AND e.starts_at <= now() + make_interval(hours => v_soon_hours)
          )
        )
        AND (
          cardinality(coalesce(prefs.themes, '{}'::text[])) = 0
          OR e.category IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.event_category ec
            WHERE ec.id = e.category
              AND ec.slug = ANY (prefs.themes)
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.notifications n
          WHERE n.user_id = v_uid
            AND n.type = 'event_nearby_live'
            AND (n.data->>'eventId') = e.id::text
            AND n.created_at > now() - interval '24 hours'
        )
      ORDER BY
        CASE WHEN e.starts_at <= now() THEN 0 ELSE 1 END,
        distance_m ASC
      LIMIT 2
    )
    SELECT * FROM candidates
  LOOP
    v_phase := r.phase;
    IF v_phase = 'live' THEN
      v_title := 'Un moment en cours près de toi';
      v_body := coalesce(nullif(trim(r.title), ''), 'Moment local') || ' — tu es à proximité.';
    ELSE
      v_title := 'Un moment bientôt près de toi';
      v_body := coalesce(nullif(trim(r.title), ''), 'Moment local') || ' commence bientôt à proximité.';
    END IF;

    PERFORM public.deliver_user_notification(
      v_uid,
      'event_nearby_live',
      v_title,
      v_body,
      jsonb_build_object(
        'eventId', r.id,
        'source', 'proximity_live',
        'phase', v_phase,
        'distanceM', round(r.distance_m)::integer
      ),
      'proximity_live'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.report_proximity_live_alerts(double precision, double precision, double precision, integer) IS
  'PUSH-P0-003: authenticated device reports a coarse position; enqueues event_nearby_live for live/soon public events in radius (theme + 24h anti-dupe). Does not store the reported coordinates.';

REVOKE ALL ON FUNCTION public.report_proximity_live_alerts(double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_proximity_live_alerts(double precision, double precision, double precision, integer) TO authenticated;
