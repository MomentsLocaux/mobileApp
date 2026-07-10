-- DISC-P0-011: Discovery profile recalculation jobs (pg_cron + SQL).
--
-- Scope:
--   - Daily job recalculates discovery_profiles, mobility_profiles, discovery_daily_summaries.
--   - Sources: engagement signals (likes, interests, favorites, checkins, views) and discovery_visits.
--   - Only users with discovery consent (enabled + personalization_enabled).
--
-- Depends on: 20260710_discovery_domain_schema.sql, 20260713_discovery_scoring_rpc.sql
-- Do NOT apply to production without human validation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------------
-- discovery_recalculate_profiles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discovery_recalculate_profiles(
  p_user_id uuid DEFAULT NULL,
  p_summary_date date DEFAULT (CURRENT_DATE - 1)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text := auth.role();
  v_profile_count integer := 0;
  v_mobility_count integer := 0;
  v_summary_count integer := 0;
  v_is_batch_actor boolean := (
    v_role = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin')
  );
BEGIN
  IF p_user_id IS NULL AND NOT v_is_batch_actor THEN
    RAISE EXCEPTION 'batch recalculation requires service_role' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL
     AND NOT v_is_batch_actor
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'cannot recalculate profile for another user' USING ERRCODE = '42501';
  END IF;

  WITH eligible AS (
    SELECT dc.user_id
    FROM public.discovery_consents dc
    WHERE dc.enabled = true
      AND dc.personalization_enabled = true
      AND (p_user_id IS NULL OR dc.user_id = p_user_id)
  ),
  category_signals AS (
    SELECT c.user_id, coalesce(e.category::text, ec.id::text) AS affinity_key, 1.0::real AS weight
    FROM public.event_checkins c
    JOIN public.events e ON e.id = c.event_id
    LEFT JOIN public.event_category ec ON ec.slug = e.category_old
    JOIN eligible el ON el.user_id = c.user_id
    WHERE coalesce(e.category, ec.id) IS NOT NULL

    UNION ALL
    SELECT i.user_id, coalesce(e.category::text, ec.id::text), 0.7::real
    FROM public.event_interests i
    JOIN public.events e ON e.id = i.event_id
    LEFT JOIN public.event_category ec ON ec.slug = e.category_old
    JOIN eligible el ON el.user_id = i.user_id
    WHERE coalesce(e.category, ec.id) IS NOT NULL

    UNION ALL
    SELECT f.profile_id, coalesce(e.category::text, ec.id::text), 0.6::real
    FROM public.favorites f
    JOIN public.events e ON e.id = f.event_id
    LEFT JOIN public.event_category ec ON ec.slug = e.category_old
    JOIN eligible el ON el.user_id = f.profile_id
    WHERE coalesce(e.category, ec.id) IS NOT NULL

    UNION ALL
    SELECT l.user_id, coalesce(e.category::text, ec.id::text), 0.4::real
    FROM public.event_likes l
    JOIN public.events e ON e.id = l.event_id
    LEFT JOIN public.event_category ec ON ec.slug = e.category_old
    JOIN eligible el ON el.user_id = l.user_id
    WHERE coalesce(e.category, ec.id) IS NOT NULL

    UNION ALL
    SELECT v.profile_id, coalesce(e.category::text, ec.id::text), 0.15::real
    FROM public.event_views v
    JOIN public.events e ON e.id = v.event_id
    LEFT JOIN public.event_category ec ON ec.slug = e.category_old
    JOIN eligible el ON el.user_id = v.profile_id
    WHERE v.viewed_at > now() - interval '7 days'
      AND coalesce(e.category, ec.id) IS NOT NULL
  ),
  category_agg AS (
    SELECT user_id, coalesce(jsonb_object_agg(affinity_key, affinity), '{}'::jsonb) AS affinities
    FROM (
      SELECT user_id, affinity_key, LEAST(1.0::real, SUM(weight) / 3.0) AS affinity
      FROM category_signals
      GROUP BY user_id, affinity_key
    ) grouped
    GROUP BY user_id
  ),
  subcategory_signals AS (
    SELECT c.user_id, e.subcategory AS affinity_key, 1.0::real AS weight
    FROM public.event_checkins c
    JOIN public.events e ON e.id = c.event_id
    JOIN eligible el ON el.user_id = c.user_id
    WHERE e.subcategory IS NOT NULL

    UNION ALL
    SELECT i.user_id, e.subcategory, 0.7::real
    FROM public.event_interests i
    JOIN public.events e ON e.id = i.event_id
    JOIN eligible el ON el.user_id = i.user_id
    WHERE e.subcategory IS NOT NULL

    UNION ALL
    SELECT l.user_id, e.subcategory, 0.4::real
    FROM public.event_likes l
    JOIN public.events e ON e.id = l.event_id
    JOIN eligible el ON el.user_id = l.user_id
    WHERE e.subcategory IS NOT NULL
  ),
  subcategory_agg AS (
    SELECT user_id, coalesce(jsonb_object_agg(affinity_key, affinity), '{}'::jsonb) AS affinities
    FROM (
      SELECT user_id, affinity_key, LEAST(1.0::real, SUM(weight) / 2.0) AS affinity
      FROM subcategory_signals
      GROUP BY user_id, affinity_key
    ) grouped
    GROUP BY user_id
  ),
  tag_signals AS (
    SELECT s.user_id, tag.tag AS affinity_key, s.weight
    FROM (
      SELECT c.user_id, e.tags, 1.0::real AS weight
      FROM public.event_checkins c
      JOIN public.events e ON e.id = c.event_id
      JOIN eligible el ON el.user_id = c.user_id

      UNION ALL
      SELECT l.user_id, e.tags, 0.4::real
      FROM public.event_likes l
      JOIN public.events e ON e.id = l.event_id
      JOIN eligible el ON el.user_id = l.user_id
    ) s
    CROSS JOIN LATERAL unnest(coalesce(s.tags, ARRAY[]::text[])) AS tag(tag)
    WHERE tag.tag IS NOT NULL AND btrim(tag.tag) <> ''
  ),
  tag_agg AS (
    SELECT user_id, coalesce(jsonb_object_agg(affinity_key, affinity), '{}'::jsonb) AS affinities
    FROM (
      SELECT user_id, affinity_key, LEAST(1.0::real, SUM(weight) / 2.0) AS affinity
      FROM tag_signals
      GROUP BY user_id, affinity_key
    ) grouped
    GROUP BY user_id
  ),
  hour_signals AS (
    SELECT
      c.user_id,
      EXTRACT(HOUR FROM c.created_at)::int AS hour,
      CASE WHEN EXTRACT(DOW FROM c.created_at) IN (0, 6) THEN 'weekend' ELSE 'weekday' END AS day_kind
    FROM public.event_checkins c
    JOIN eligible el ON el.user_id = c.user_id
  ),
  weekday_hours AS (
    SELECT user_id, coalesce(jsonb_agg(DISTINCT hour ORDER BY hour), '[]'::jsonb) AS hours
    FROM hour_signals
    WHERE day_kind = 'weekday'
    GROUP BY user_id
  ),
  weekend_hours AS (
    SELECT user_id, coalesce(jsonb_agg(DISTINCT hour ORDER BY hour), '[]'::jsonb) AS hours
    FROM hour_signals
    WHERE day_kind = 'weekend'
    GROUP BY user_id
  ),
  profile_payload AS (
    SELECT
      el.user_id,
      coalesce(ca.affinities, '{}'::jsonb) AS category_affinities,
      coalesce(sa.affinities, '{}'::jsonb) AS subcategory_affinities,
      coalesce(ta.affinities, '{}'::jsonb) AS tag_affinities,
      coalesce(wh.hours, '[]'::jsonb) AS typical_weekday_hours,
      coalesce(weh.hours, '[]'::jsonb) AS typical_weekend_hours,
      CASE
        WHEN ca.affinities IS NULL OR ca.affinities = '{}'::jsonb THEN 0.25::real
        ELSE 0.55::real
      END AS confidence
    FROM eligible el
    LEFT JOIN category_agg ca ON ca.user_id = el.user_id
    LEFT JOIN subcategory_agg sa ON sa.user_id = el.user_id
    LEFT JOIN tag_agg ta ON ta.user_id = el.user_id
    LEFT JOIN weekday_hours wh ON wh.user_id = el.user_id
    LEFT JOIN weekend_hours weh ON weh.user_id = el.user_id
  )
  INSERT INTO public.discovery_profiles (
    user_id,
    category_affinities,
    subcategory_affinities,
    tag_affinities,
    typical_weekday_hours,
    typical_weekend_hours,
    calculated_at,
    model_version
  )
  SELECT
    pp.user_id,
    pp.category_affinities,
    pp.subcategory_affinities,
    pp.tag_affinities,
    pp.typical_weekday_hours,
    pp.typical_weekend_hours,
    now(),
    '1.0'
  FROM profile_payload pp
  ON CONFLICT (user_id) DO UPDATE
  SET
    category_affinities = EXCLUDED.category_affinities,
    subcategory_affinities = EXCLUDED.subcategory_affinities,
    tag_affinities = EXCLUDED.tag_affinities,
    typical_weekday_hours = EXCLUDED.typical_weekday_hours,
    typical_weekend_hours = EXCLUDED.typical_weekend_hours,
    calculated_at = EXCLUDED.calculated_at,
    model_version = EXCLUDED.model_version;

  GET DIAGNOSTICS v_profile_count = ROW_COUNT;

  WITH eligible AS (
    SELECT dc.user_id
    FROM public.discovery_consents dc
    WHERE dc.enabled = true
      AND dc.personalization_enabled = true
      AND (p_user_id IS NULL OR dc.user_id = p_user_id)
  ),
  user_ref AS (
    SELECT
      el.user_id,
      COALESCE(
        up.home_location,
        (
          SELECT ST_Centroid(ST_Collect(ev_geog.geog::geometry))::geography
          FROM public.event_checkins cc
          JOIN public.events ev ON ev.id = cc.event_id
          CROSS JOIN LATERAL (
            SELECT COALESCE(
              ev.location,
              CASE
                WHEN ev.latitude IS NOT NULL AND ev.longitude IS NOT NULL
                  THEN ST_SetSRID(ST_MakePoint(ev.longitude, ev.latitude), 4326)::geography
                ELSE NULL
              END
            ) AS geog
          ) ev_geog
          WHERE cc.user_id = el.user_id
            AND ev_geog.geog IS NOT NULL
        )
      ) AS ref_geog
    FROM eligible el
    LEFT JOIN public.user_preferences up ON up.user_id = el.user_id
  ),
  checkin_dists AS (
    SELECT
      c.user_id,
      CASE WHEN EXTRACT(DOW FROM c.created_at) IN (0, 6) THEN 'weekend' ELSE 'weekday' END AS day_kind,
      (ST_Distance(ur.ref_geog, ev_geog.geog) / 1000.0)::real AS distance_km
    FROM public.event_checkins c
    JOIN eligible el ON el.user_id = c.user_id
    JOIN public.events e ON e.id = c.event_id
    JOIN user_ref ur ON ur.user_id = c.user_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        e.location,
        CASE
          WHEN e.latitude IS NOT NULL AND e.longitude IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography
          ELSE NULL
        END
      ) AS geog
    ) ev_geog
    WHERE ur.ref_geog IS NOT NULL
      AND ev_geog.geog IS NOT NULL
  ),
  mobility_stats AS (
    SELECT
      el.user_id,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY cd.distance_km) FILTER (WHERE cd.day_kind = 'weekday') AS weekday_radius_km,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY cd.distance_km) FILTER (WHERE cd.day_kind = 'weekend') AS weekend_radius_km,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY cd.distance_km) AS median_trip_distance_km,
      MAX(cd.distance_km) AS max_typical_distance_km,
      COUNT(cd.distance_km) AS sample_size
    FROM eligible el
    LEFT JOIN checkin_dists cd ON cd.user_id = el.user_id
    GROUP BY el.user_id
  )
  INSERT INTO public.mobility_profiles (
    user_id,
    weekday_radius_km,
    weekend_radius_km,
    median_trip_distance_km,
    max_typical_distance_km,
    calculated_at,
    confidence,
    model_version
  )
  SELECT
    ms.user_id,
    coalesce(ms.weekday_radius_km, 25.0)::real,
    coalesce(ms.weekend_radius_km, 35.0)::real,
    ms.median_trip_distance_km,
    coalesce(ms.max_typical_distance_km, 25.0)::real,
    now(),
    CASE
      WHEN coalesce(ms.sample_size, 0) >= 5 THEN 0.6::real
      WHEN coalesce(ms.sample_size, 0) > 0 THEN 0.35::real
      ELSE 0.2::real
    END,
    '1.0'
  FROM mobility_stats ms
  ON CONFLICT (user_id) DO UPDATE
  SET
    weekday_radius_km = EXCLUDED.weekday_radius_km,
    weekend_radius_km = EXCLUDED.weekend_radius_km,
    median_trip_distance_km = EXCLUDED.median_trip_distance_km,
    max_typical_distance_km = EXCLUDED.max_typical_distance_km,
    calculated_at = EXCLUDED.calculated_at,
    confidence = EXCLUDED.confidence,
    model_version = EXCLUDED.model_version;

  GET DIAGNOSTICS v_mobility_count = ROW_COUNT;

  WITH eligible AS (
    SELECT dc.user_id
    FROM public.discovery_consents dc
    WHERE dc.enabled = true
      AND dc.personalization_enabled = true
      AND (p_user_id IS NULL OR dc.user_id = p_user_id)
  ),
  visit_day AS (
    SELECT
      dv.user_id,
      COUNT(DISTINCT dv.place_id) AS places_count,
      COUNT(DISTINCT dv.place_id) FILTER (
        WHERE dp.first_seen_at::date = p_summary_date
      ) AS new_places_count,
      COALESCE(SUM(dv.duration_minutes), 0) AS moving_minutes,
      COALESCE(MAX(
        CASE
          WHEN up.home_location IS NOT NULL AND dp.centroid_latitude IS NOT NULL AND dp.centroid_longitude IS NOT NULL
            THEN (ST_Distance(
              up.home_location,
              ST_SetSRID(ST_MakePoint(dp.centroid_longitude, dp.centroid_latitude), 4326)::geography
            ) / 1000.0)::real
          ELSE NULL
        END
      ), 0)::real AS radius_km
    FROM public.discovery_visits dv
    JOIN eligible el ON el.user_id = dv.user_id
    LEFT JOIN public.discovery_places dp ON dp.id = dv.place_id
    LEFT JOIN public.user_preferences up ON up.user_id = dv.user_id
    WHERE dv.arrived_at >= p_summary_date::timestamptz
      AND dv.arrived_at < (p_summary_date + 1)::timestamptz
    GROUP BY dv.user_id
  )
  INSERT INTO public.discovery_daily_summaries (
    user_id,
    date,
    places_count,
    new_places_count,
    distance_km,
    radius_km,
    moving_minutes,
    stationary_minutes,
    metadata
  )
  SELECT
    vd.user_id,
    p_summary_date,
    vd.places_count,
    vd.new_places_count,
    0::real,
    NULLIF(vd.radius_km, 0),
    vd.moving_minutes,
    0,
    jsonb_build_object('source', 'discovery_recalculate_profiles_v1')
  FROM visit_day vd
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    places_count = EXCLUDED.places_count,
    new_places_count = EXCLUDED.new_places_count,
    radius_km = EXCLUDED.radius_km,
    moving_minutes = EXCLUDED.moving_minutes,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_summary_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'profiles_updated', v_profile_count,
    'mobility_updated', v_mobility_count,
    'summaries_updated', v_summary_count,
    'summary_date', p_summary_date,
    'user_id', p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_recalculate_profiles(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_recalculate_profiles(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.discovery_recalculate_profiles(uuid, date) IS
  'Recalculates discovery_profiles, mobility_profiles, and discovery_daily_summaries for consenting users. Batch mode (NULL user_id) is service_role only.';

-- ---------------------------------------------------------------------------
-- pg_cron — daily at 03:00 UTC
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-recalculate-profiles') THEN
    PERFORM cron.unschedule('discovery-recalculate-profiles');
  END IF;
END$$;

SELECT cron.schedule(
  'discovery-recalculate-profiles',
  '0 3 * * *',
  $job$ SELECT public.discovery_recalculate_profiles(); $job$
);

NOTIFY pgrst, 'reload schema';

COMMIT;
