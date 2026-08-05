-- Roadtrip (feat/roadtrip-planner) — étape 2 : moteur corridor temporel.
-- RPC de préfiltre des candidats le long d'un tracé : corridor PostGIS
-- (ST_DWithin sur events.location, index GIST idx_events_location) + fenêtre
-- temporelle globale du voyage. Le calcul fin (heure de passage par tronçon,
-- fenêtres de présence, classement) reste côté client, testé unitairement.
--
-- ⚠️ Livrée sur la branche, NE PAS appliquer en production sans validation humaine.
--
-- Sécurité :
-- - SECURITY DEFINER aligné sur list_map_viewport (les événements retournés
--   sont exclusivement published + public).
-- - Paramètres bornés : corridor 500 m → 15 km, fenêtre ≤ 14 jours,
--   limite ≤ 300 lignes, tracé ≤ 1000 points.
-- - Aucune donnée du voyage n'est persistée : le tracé n'est qu'un paramètre.

CREATE OR REPLACE FUNCTION public.list_roadtrip_event_candidates(
  p_route_geojson text,
  p_corridor_m integer DEFAULT 7500,
  p_window_start timestamptz DEFAULT now(),
  p_window_end timestamptz DEFAULT NULL,
  p_categories uuid[] DEFAULT NULL,
  p_free_only boolean DEFAULT false,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  cover_url text,
  category uuid,
  category_slug text,
  category_icon text,
  tags text[],
  starts_at timestamptz,
  ends_at timestamptz,
  schedule_mode text,
  operating_hours jsonb,
  latitude double precision,
  longitude double precision,
  address text,
  city text,
  postal_code text,
  venue_name text,
  is_free boolean,
  price numeric,
  status text,
  visibility text,
  creator_id uuid,
  creator_display_name text,
  creator_avatar_url text,
  distance_to_route_m double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_route geography;
  v_corridor integer := GREATEST(500, LEAST(COALESCE(p_corridor_m, 7500), 15000));
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 200), 300));
  v_start timestamptz := COALESCE(p_window_start, now());
  v_end timestamptz;
BEGIN
  -- Fenêtre plafonnée à la durée max d'un voyage (14 jours).
  v_end := LEAST(COALESCE(p_window_end, v_start + interval '14 days'), v_start + interval '14 days');
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'roadtrip: invalid time window';
  END IF;

  BEGIN
    v_route := st_geomfromgeojson(p_route_geojson)::geography;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'roadtrip: invalid route geometry';
  END;

  IF st_geometrytype(v_route::geometry) NOT IN ('ST_LineString', 'ST_MultiLineString') THEN
    RAISE EXCEPTION 'roadtrip: route must be a LineString';
  END IF;
  IF st_npoints(v_route::geometry) > 1000 THEN
    RAISE EXCEPTION 'roadtrip: route geometry too large (max 1000 points)';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.cover_url,
    e.category,
    ec.slug AS category_slug,
    ec.icon AS category_icon,
    e.tags,
    e.starts_at,
    e.ends_at,
    e.schedule_mode,
    e.operating_hours,
    e.latitude,
    e.longitude,
    e.address,
    e.city,
    e.postal_code,
    e.venue_name,
    e.is_free,
    e.price,
    e.status::text AS status,
    e.visibility,
    e.creator_id,
    p.display_name AS creator_display_name,
    CASE
      WHEN p.avatar_url IS NULL THEN NULL
      WHEN length(p.avatar_url) > 512 THEN NULL
      WHEN p.avatar_url LIKE 'http://%' OR p.avatar_url LIKE 'https://%' THEN p.avatar_url
      ELSE NULL
    END AS creator_avatar_url,
    st_distance(e.location, v_route) AS distance_to_route_m
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.creator_id
  LEFT JOIN public.event_category ec ON ec.id = e.category
  WHERE e.status = 'published'
    AND e.visibility = 'public'
    AND e.location IS NOT NULL
    AND NOT (e.latitude = 0 AND e.longitude = 0)
    AND st_dwithin(e.location, v_route, v_corridor)
    AND e.starts_at <= v_end
    AND COALESCE(e.ends_at, e.starts_at) >= v_start
    AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR e.category = ANY (p_categories))
    AND (NOT COALESCE(p_free_only, false) OR e.is_free)
  ORDER BY st_distance(e.location, v_route) ASC, e.starts_at ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_roadtrip_event_candidates(
  text, integer, timestamptz, timestamptz, uuid[], boolean, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_roadtrip_event_candidates(
  text, integer, timestamptz, timestamptz, uuid[], boolean, integer
) TO anon, authenticated, service_role;
