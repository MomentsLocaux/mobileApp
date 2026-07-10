-- DISC-P1-003: Discovery insights generation job + get_active_insights RPC.
-- Do NOT apply to production without human validation.

BEGIN;

CREATE OR REPLACE FUNCTION public.discovery_generate_insights(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.role();
  v_is_batch_actor boolean := (
    v_role = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin')
  );
  v_inserted integer := 0;
BEGIN
  IF p_user_id IS NULL AND NOT v_is_batch_actor THEN
    RAISE EXCEPTION 'batch insight generation requires service_role' USING ERRCODE = '42501';
  END IF;

  WITH eligible AS (
    SELECT dc.user_id
    FROM public.discovery_consents dc
    WHERE dc.enabled = true
      AND dc.personalization_enabled = true
      AND (p_user_id IS NULL OR dc.user_id = p_user_id)
  ),
  no_new AS (
    SELECT el.user_id
    FROM eligible el
    JOIN LATERAL (
      SELECT MAX(dp.last_seen_at) AS last_seen, COUNT(*) AS place_count
      FROM public.discovery_places dp
      WHERE dp.user_id = el.user_id
    ) stats ON true
    WHERE stats.place_count >= 3
      AND stats.last_seen < now() - interval '14 days'
  ),
  repetitive AS (
    SELECT el.user_id
    FROM eligible el
    JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE EXTRACT(DOW FROM dv.arrived_at) IN (0, 6)) AS weekend_visits,
             COUNT(*) AS total_visits
      FROM public.discovery_visits dv
      WHERE dv.user_id = el.user_id
        AND dv.arrived_at > now() - interval '30 days'
    ) stats ON true
    WHERE stats.total_visits >= 4
      AND stats.weekend_visits::numeric / GREATEST(stats.total_visits, 1) >= 0.75
  ),
  payload AS (
    SELECT
      n.user_id,
      'no_new_place_recently'::public.discovery_insight_type AS type,
      'Envie de changer d''air ?'::text AS title,
      'Vous n''avez pas exploré de nouveau lieu récemment. Et si vous élargissiez un peu votre territoire ?'::text AS body,
      0.7::real AS score,
      0.6::real AS confidence,
      now() + interval '7 days' AS valid_until
    FROM no_new n
  UNION ALL
    SELECT
      r.user_id,
      'repetitive_weekends'::public.discovery_insight_type,
      'Week-ends en boucle ?',
      'Vos sorties du week-end suivent souvent les mêmes zones. Trois idées différentes pourraient vous surprendre.',
      0.75,
      0.55,
      now() + interval '7 days'
    FROM repetitive r
  )
  INSERT INTO public.discovery_insights (
    user_id, type, title, body, score, confidence, valid_from, valid_until, metadata
  )
  SELECT
    p.user_id,
    p.type,
    p.title,
    p.body,
    p.score,
    p.confidence,
    now(),
    p.valid_until,
    jsonb_build_object('source', 'discovery_generate_insights_v1')
  FROM payload p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.discovery_insights di
    WHERE di.user_id = p.user_id
      AND di.type = p.type
      AND di.valid_until > now()
      AND di.seen_at IS NULL
  );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'inserted', v_inserted, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.discovery_generate_insights(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_generate_insights(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_active_insights(p_limit integer DEFAULT 10)
RETURNS SETOF public.discovery_insights
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT di.*
  FROM public.discovery_insights di
  WHERE di.user_id = auth.uid()
    AND di.valid_until > now()
    AND di.seen_at IS NULL
  ORDER BY di.score DESC, di.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 20));
$$;

REVOKE ALL ON FUNCTION public.get_active_insights(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_insights(integer) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'discovery-generate-insights') THEN
    PERFORM cron.unschedule('discovery-generate-insights');
  END IF;
END $$;

SELECT cron.schedule(
  'discovery-generate-insights',
  '15 4 * * *',
  $$SELECT public.discovery_generate_insights();$$
);

COMMIT;
