-- DISC-P1-006: Match discovery outcomes (recommendation → visit / check-in).
-- Depends on: discovery domain schema, discovery_visits, event_recommendations.
-- Do NOT apply to production without human validation.

BEGIN;

CREATE OR REPLACE FUNCTION public.discovery_match_outcomes(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text := auth.role();
  v_is_batch_actor boolean := (
    v_role = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin')
  );
  v_checkin_matches integer := 0;
  v_visit_matches integer := 0;
BEGIN
  IF p_user_id IS NULL AND NOT v_is_batch_actor THEN
    RAISE EXCEPTION 'batch outcome matching requires service_role' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL
     AND NOT v_is_batch_actor
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'cannot match outcomes for another user' USING ERRCODE = '42501';
  END IF;

  WITH open_recs AS (
    SELECT er.*
    FROM public.event_recommendations er
    JOIN public.discovery_consents dc
      ON dc.user_id = er.user_id
     AND dc.enabled = true
     AND dc.personalization_enabled = true
    WHERE er.generated_at > now() - interval '14 days'
      AND (p_user_id IS NULL OR er.user_id = p_user_id)
  ),
  checkin_hits AS (
    SELECT DISTINCT er.id AS recommendation_id, er.user_id, ec.created_at AS matched_at
    FROM open_recs er
    JOIN public.event_checkins ec
      ON ec.event_id = er.event_id
     AND ec.user_id = er.user_id
    WHERE er.confirmed_checkin_at IS NULL
      AND ec.created_at >= COALESCE(er.displayed_at, er.opened_at, er.generated_at)
      AND ec.created_at <= COALESCE(er.displayed_at, er.opened_at, er.generated_at) + interval '7 days'
  ),
  visit_hits AS (
    SELECT DISTINCT er.id AS recommendation_id, er.user_id, dv.arrived_at AS matched_at
    FROM open_recs er
    JOIN public.events e ON e.id = er.event_id
    JOIN public.discovery_visits dv ON dv.user_id = er.user_id
    JOIN public.discovery_places dp ON dp.id = dv.place_id
    WHERE er.probable_visit_at IS NULL
      AND e.latitude IS NOT NULL
      AND e.longitude IS NOT NULL
      AND dv.arrived_at >= COALESCE(er.displayed_at, er.opened_at, er.generated_at)
      AND dv.arrived_at <= COALESCE(er.displayed_at, er.opened_at, er.generated_at) + interval '48 hours'
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(dp.centroid_longitude, dp.centroid_latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
        2000
      )
  )
  INSERT INTO public.recommendation_events (recommendation_id, user_id, event_type, metadata)
  SELECT ch.recommendation_id, ch.user_id, 'confirmed_checkin', jsonb_build_object('source', 'discovery_match_outcomes_v1', 'matched_at', ch.matched_at)
  FROM checkin_hits ch;

  GET DIAGNOSTICS v_checkin_matches = ROW_COUNT;

  WITH open_recs AS (
    SELECT er.*
    FROM public.event_recommendations er
    JOIN public.discovery_consents dc
      ON dc.user_id = er.user_id
     AND dc.enabled = true
     AND dc.personalization_enabled = true
    WHERE er.generated_at > now() - interval '14 days'
      AND (p_user_id IS NULL OR er.user_id = p_user_id)
  ),
  visit_hits AS (
    SELECT DISTINCT er.id AS recommendation_id, er.user_id, dv.arrived_at AS matched_at
    FROM open_recs er
    JOIN public.events e ON e.id = er.event_id
    JOIN public.discovery_visits dv ON dv.user_id = er.user_id
    JOIN public.discovery_places dp ON dp.id = dv.place_id
    WHERE er.probable_visit_at IS NULL
      AND e.latitude IS NOT NULL
      AND e.longitude IS NOT NULL
      AND dv.arrived_at >= COALESCE(er.displayed_at, er.opened_at, er.generated_at)
      AND dv.arrived_at <= COALESCE(er.displayed_at, er.opened_at, er.generated_at) + interval '48 hours'
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(dp.centroid_longitude, dp.centroid_latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
        2000
      )
  )
  INSERT INTO public.recommendation_events (recommendation_id, user_id, event_type, metadata)
  SELECT vh.recommendation_id, vh.user_id, 'probable_visit', jsonb_build_object('source', 'discovery_match_outcomes_v1', 'matched_at', vh.matched_at)
  FROM visit_hits vh;

  GET DIAGNOSTICS v_visit_matches = ROW_COUNT;

  UPDATE public.event_recommendations er
  SET confirmed_checkin_at = COALESCE(er.confirmed_checkin_at, sub.matched_at)
  FROM (
    SELECT DISTINCT er2.id, ec.created_at AS matched_at
    FROM public.event_recommendations er2
    JOIN public.event_checkins ec ON ec.event_id = er2.event_id AND ec.user_id = er2.user_id
    WHERE er2.confirmed_checkin_at IS NULL
      AND ec.created_at >= COALESCE(er2.displayed_at, er2.opened_at, er2.generated_at)
      AND (p_user_id IS NULL OR er2.user_id = p_user_id)
  ) sub
  WHERE er.id = sub.id;

  UPDATE public.event_recommendations er
  SET probable_visit_at = COALESCE(er.probable_visit_at, sub.matched_at)
  FROM (
    SELECT DISTINCT er2.id, dv.arrived_at AS matched_at
    FROM public.event_recommendations er2
    JOIN public.events e ON e.id = er2.event_id
    JOIN public.discovery_visits dv ON dv.user_id = er2.user_id
    JOIN public.discovery_places dp ON dp.id = dv.place_id
    WHERE er2.probable_visit_at IS NULL
      AND e.latitude IS NOT NULL
      AND e.longitude IS NOT NULL
      AND dv.arrived_at >= COALESCE(er2.displayed_at, er2.opened_at, er2.generated_at)
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(dp.centroid_longitude, dp.centroid_latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
        2000
      )
      AND (p_user_id IS NULL OR er2.user_id = p_user_id)
  ) sub
  WHERE er.id = sub.id;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_events_inserted', v_checkin_matches,
    'probable_visit_events_inserted', v_visit_matches,
    'user_id', p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_match_outcomes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_match_outcomes(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-match-outcomes') THEN
    PERFORM cron.unschedule('discovery-match-outcomes');
  END IF;
END $$;

SELECT cron.schedule(
  'discovery-match-outcomes',
  '0 */6 * * *',
  $$SELECT public.discovery_match_outcomes();$$
);

COMMIT;
