-- DISC-P0-006: Discovery scoring RPCs (candidate fetch + cold-start affinities).
--
-- Scope:
--   - PostGIS candidate selection for published public events.
--   - Engagement-derived category affinities for cold-start scoring.
--
-- Depends on: 20260710_discovery_domain_schema.sql
-- Do NOT apply to production without human validation.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Engagement affinities (cold start when discovery_profiles is empty)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discovery_engagement_affinities(
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_role text := auth.role();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'cannot read affinities for another user' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (
      WITH signals AS (
        SELECT coalesce(e.category::text, ec.id::text) AS cat_key, 1.0::real AS w
        FROM public.event_checkins c
        JOIN public.events e ON e.id = c.event_id
        LEFT JOIN public.event_category ec ON ec.slug = e.category_old
        WHERE c.user_id = v_user_id
          AND coalesce(e.category, ec.id) IS NOT NULL

        UNION ALL

        SELECT coalesce(e.category::text, ec.id::text), 0.7::real
        FROM public.event_interests i
        JOIN public.events e ON e.id = i.event_id
        LEFT JOIN public.event_category ec ON ec.slug = e.category_old
        WHERE i.user_id = v_user_id
          AND coalesce(e.category, ec.id) IS NOT NULL

        UNION ALL

        SELECT coalesce(e.category::text, ec.id::text), 0.6::real
        FROM public.favorites f
        JOIN public.events e ON e.id = f.event_id
        LEFT JOIN public.event_category ec ON ec.slug = e.category_old
        WHERE f.profile_id = v_user_id
          AND coalesce(e.category, ec.id) IS NOT NULL

        UNION ALL

        SELECT coalesce(e.category::text, ec.id::text), 0.4::real
        FROM public.event_likes l
        JOIN public.events e ON e.id = l.event_id
        LEFT JOIN public.event_category ec ON ec.slug = e.category_old
        WHERE l.user_id = v_user_id
          AND coalesce(e.category, ec.id) IS NOT NULL

        UNION ALL

        SELECT coalesce(e.category::text, ec.id::text), 0.15::real
        FROM public.event_views v
        JOIN public.events e ON e.id = v.event_id
        LEFT JOIN public.event_category ec ON ec.slug = e.category_old
        WHERE v.profile_id = v_user_id
          AND v.viewed_at > now() - interval '7 days'
          AND coalesce(e.category, ec.id) IS NOT NULL
      )
      SELECT jsonb_object_agg(cat_key, affinity)
      FROM (
        SELECT cat_key, LEAST(1.0::real, SUM(w) / 3.0) AS affinity
        FROM signals
        GROUP BY cat_key
      ) agg
    ),
    '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_discovery_engagement_affinities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_engagement_affinities(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Candidate events within radius + time window (PostGIS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discovery_scoring_candidates(
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision DEFAULT 25,
  p_horizon_hours integer DEFAULT 48
)
RETURNS TABLE (
  event_id uuid,
  category uuid,
  subcategory text,
  tags text[],
  starts_at timestamptz,
  latitude double precision,
  longitude double precision,
  creator_id uuid,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH user_point AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography AS geog
  ),
  bounds AS (
    SELECT
      now() AS ts_now,
      now() + make_interval(hours => GREATEST(1, LEAST(COALESCE(p_horizon_hours, 48), 168))) AS ts_until,
      GREATEST(1.0, LEAST(COALESCE(p_radius_km, 25.0), 200.0)) AS radius_km
  )
  SELECT
    e.id AS event_id,
    e.category,
    e.subcategory,
    e.tags,
    e.starts_at,
    e.latitude,
    e.longitude,
    e.creator_id,
    (ST_Distance(event_geog.geog, user_point.geog) / 1000.0)::double precision AS distance_km
  FROM public.events e
  CROSS JOIN user_point
  CROSS JOIN bounds
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
  WHERE auth.uid() IS NOT NULL
    AND e.status = 'published'
    AND e.visibility = 'public'
    AND e.starts_at > bounds.ts_now
    AND e.starts_at <= bounds.ts_until
    AND event_geog.geog IS NOT NULL
    AND ST_DWithin(event_geog.geog, user_point.geog, bounds.radius_km * 1000.0)
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_recommendations er
      WHERE er.user_id = auth.uid()
        AND er.event_id = e.id
        AND er.dismissed_at IS NOT NULL
        AND er.dismissed_at > bounds.ts_now - interval '48 hours'
    )
  ORDER BY e.starts_at ASC, distance_km ASC
  LIMIT 250;
$$;

REVOKE ALL ON FUNCTION public.get_discovery_scoring_candidates(double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_scoring_candidates(double precision, double precision, double precision, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Home location coordinates for scoring fallback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_home_location_coords(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_role text := auth.role();
  v_lat double precision;
  v_lon double precision;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'cannot read home location for another user' USING ERRCODE = '42501';
  END IF;

  SELECT
    ST_Y(up.home_location::geometry),
    ST_X(up.home_location::geometry)
  INTO v_lat, v_lon
  FROM public.user_preferences up
  WHERE up.user_id = v_user_id
    AND up.home_location IS NOT NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('lat', v_lat, 'lon', v_lon);
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_location_coords(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_location_coords(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
