-- Correctif : 20260901 convertissait le rayon après GREATEST(1000, km),
-- donc 25 km → 1 000 km. Le deck client recoupait le vrai cercle et ne
-- gardait que ~5 cartes. Convertir en mètres APRES le clamp km.
-- CREATE OR REPLACE : idempotent si la fonction DEV a déjà été patchée.

CREATE OR REPLACE FUNCTION public.list_proposal_candidates(
  p_lat double precision,
  p_lon double precision,
  p_radius_km integer DEFAULT 25,
  p_window_start timestamptz DEFAULT NULL,
  p_window_end timestamptz DEFAULT NULL,
  p_categories uuid[] DEFAULT NULL,
  p_exclude_ids uuid[] DEFAULT NULL,
  p_limit integer DEFAULT 80
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  cover_url text,
  category uuid,
  subcategory uuid,
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
  boosted_until timestamptz,
  early_access_until timestamptz,
  status text,
  visibility text,
  comments_count integer,
  media_count integer,
  creator_id uuid,
  creator_display_name text,
  creator_avatar_url text,
  category_slug text,
  category_icon text,
  interests_count integer,
  checkins_count integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_anchor geography;
  v_radius_m integer;
  v_limit integer;
  v_start timestamptz;
  v_end timestamptz;
  v_uid uuid := auth.uid();
  v_exclude uuid[];
BEGIN
  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lon < -180 OR p_lon > 180 THEN
    RETURN;
  END IF;

  v_start := p_window_start;
  v_end := p_window_end;
  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;
  IF v_end < v_start THEN
    RETURN;
  END IF;
  IF v_end > v_start + interval '366 days' THEN
    v_end := v_start + interval '366 days';
  END IF;

  -- Floor 1 km, cap 50 km. Convert to meters after the km clamp (not before).
  v_radius_m := GREATEST(1000, LEAST(COALESCE(p_radius_km, 25), 50) * 1000);
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 80), 80));
  v_anchor := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
  v_exclude := COALESCE(p_exclude_ids[1:500], ARRAY[]::uuid[]);

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.cover_url,
    e.category,
    e.subcategory,
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
    e.boosted_until,
    e.early_access_until,
    e.status::text AS status,
    e.visibility,
    e.comments_count,
    e.media_count,
    e.creator_id,
    p.display_name AS creator_display_name,
    CASE
      WHEN p.avatar_url IS NULL THEN NULL
      WHEN length(p.avatar_url) > 512 THEN NULL
      WHEN p.avatar_url LIKE 'http://%' OR p.avatar_url LIKE 'https://%' THEN p.avatar_url
      ELSE NULL
    END AS creator_avatar_url,
    ec.slug AS category_slug,
    ec.icon AS category_icon,
    COALESCE((
      SELECT COUNT(*)::integer FROM public.event_interests ei WHERE ei.event_id = e.id
    ), 0) AS interests_count,
    COALESCE((
      SELECT COUNT(*)::integer FROM public.event_checkins ec2 WHERE ec2.event_id = e.id
    ), 0) AS checkins_count
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.creator_id
  LEFT JOIN public.event_category ec ON ec.id = e.category
  WHERE e.status = 'published'
    AND e.visibility = 'public'
    AND e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND NOT (e.latitude = 0 AND e.longitude = 0)
    AND (
      (e.location IS NOT NULL AND st_dwithin(e.location, v_anchor, v_radius_m))
      OR (
        e.location IS NULL
        AND st_dwithin(
          st_setsrid(st_makepoint(e.longitude, e.latitude), 4326)::geography,
          v_anchor,
          v_radius_m
        )
      )
    )
    AND e.starts_at IS NOT NULL
    AND e.starts_at <= v_end
    AND COALESCE(
      e.ends_at,
      ((e.starts_at AT TIME ZONE 'Europe/Paris')::date + time '23:59:59.999')
        AT TIME ZONE 'Europe/Paris'
    ) >= v_start
    AND (
      p_categories IS NULL
      OR cardinality(p_categories) = 0
      OR e.category = ANY (p_categories)
    )
    AND (
      cardinality(v_exclude) = 0
      OR NOT (e.id = ANY (v_exclude))
    )
    AND (
      v_uid IS NULL
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.event_likes el
          WHERE el.event_id = e.id AND el.user_id = v_uid
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.favorites f
          WHERE f.event_id = e.id AND f.profile_id = v_uid
        )
      )
    )
  ORDER BY random()
  LIMIT v_limit;
END;
$$;
