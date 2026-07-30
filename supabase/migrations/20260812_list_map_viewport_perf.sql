-- MVP-P2-004 Phase 1: list_map_viewport — fast card-lite map browse (1 hop).
-- - Scalar lat/lon bbox + partial indexes (not PostGIS on mostly-NULL location)
-- - Strip non-http / oversized profile avatar_url (data-URIs blew payloads to multi-MB)
-- - Join profiles/category only after LIMIT
-- DO NOT apply without human validation on new envs (already applied iteratively on DEV).

BEGIN;

CREATE INDEX IF NOT EXISTS events_map_pub_starts_idx
  ON public.events (starts_at ASC NULLS LAST)
  WHERE status = 'published' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS events_map_pub_ends_idx
  ON public.events (ends_at DESC NULLS LAST)
  WHERE status = 'published' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS events_map_pub_lat_lon_idx
  ON public.events (latitude, longitude)
  WHERE status = 'published' AND visibility = 'public';

CREATE OR REPLACE FUNCTION public.list_map_viewport(
  p_min_lon double precision,
  p_min_lat double precision,
  p_max_lon double precision,
  p_max_lat double precision,
  p_time_scope text DEFAULT 'current',
  p_limit integer DEFAULT 300,
  p_merge_upcoming boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  title text,
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
  category_icon text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      LEAST(p_min_lon, p_max_lon) AS min_lon,
      GREATEST(p_min_lon, p_max_lon) AS max_lon,
      LEAST(p_min_lat, p_max_lat) AS min_lat,
      GREATEST(p_min_lat, p_max_lat) AS max_lat,
      now() AS ts_now,
      date_trunc('day', now()) AS start_of_today,
      GREATEST(1, LEAST(COALESCE(p_limit, 300), 1500)) AS lim,
      CASE
        WHEN COALESCE(NULLIF(trim(p_time_scope), ''), 'current') IN ('ongoing', 'upcoming', 'current', 'all')
          THEN COALESCE(NULLIF(trim(p_time_scope), ''), 'current')
        ELSE 'current'
      END AS scope,
      COALESCE(p_merge_upcoming, false) AS merge_upcoming
  ),
  filtered AS (
    SELECT
      e.id,
      e.title,
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
      e.creator_id
    FROM public.events e
    CROSS JOIN bounds b
    WHERE e.status = 'published'
      AND e.visibility = 'public'
      AND e.longitude IS NOT NULL
      AND e.latitude IS NOT NULL
      AND e.longitude >= b.min_lon
      AND e.longitude <= b.max_lon
      AND e.latitude >= b.min_lat
      AND e.latitude <= b.max_lat
      AND NOT (e.latitude = 0 AND e.longitude = 0)
      AND (
        b.scope = 'all'
        OR (b.scope = 'upcoming' AND e.starts_at > b.ts_now)
        OR (
          b.scope = 'ongoing'
          AND e.starts_at <= b.ts_now
          AND (e.ends_at IS NULL OR e.ends_at >= b.ts_now)
        )
        OR (
          b.scope = 'current'
          AND (
            e.starts_at > b.ts_now
            OR e.ends_at >= b.ts_now
            OR (e.ends_at IS NULL AND e.starts_at >= b.start_of_today)
          )
        )
      )
  ),
  primary_rows AS (
    SELECT f.*
    FROM filtered f
    CROSS JOIN bounds b
    ORDER BY
      CASE WHEN f.boosted_until IS NOT NULL AND f.boosted_until > b.ts_now THEN 0 ELSE 1 END,
      f.starts_at ASC NULLS LAST
    LIMIT (SELECT lim FROM bounds)
  ),
  upcoming_extra AS (
    SELECT f.*
    FROM filtered f
    CROSS JOIN bounds b
    WHERE b.merge_upcoming
      AND b.scope = 'current'
      AND f.starts_at > b.ts_now
      AND NOT EXISTS (SELECT 1 FROM primary_rows pr WHERE pr.id = f.id)
    ORDER BY f.starts_at ASC NULLS LAST
    LIMIT (SELECT lim FROM bounds)
  ),
  limited AS (
    SELECT * FROM primary_rows
    UNION ALL
    SELECT * FROM upcoming_extra
  )
  SELECT
    l.id,
    l.title,
    l.cover_url,
    l.category,
    l.subcategory,
    l.tags,
    l.starts_at,
    l.ends_at,
    l.schedule_mode,
    l.operating_hours,
    l.latitude,
    l.longitude,
    l.address,
    l.city,
    l.postal_code,
    l.venue_name,
    l.is_free,
    l.price,
    l.boosted_until,
    l.early_access_until,
    l.status,
    l.visibility,
    l.comments_count,
    l.media_count,
    l.creator_id,
    p.display_name AS creator_display_name,
    -- Never return data-URI / huge avatars (was multi-MB per viewport response).
    CASE
      WHEN p.avatar_url IS NULL THEN NULL
      WHEN length(p.avatar_url) > 512 THEN NULL
      WHEN p.avatar_url LIKE 'http://%' OR p.avatar_url LIKE 'https://%' THEN p.avatar_url
      ELSE NULL
    END AS creator_avatar_url,
    ec.slug AS category_slug,
    ec.icon AS category_icon
  FROM limited l
  LEFT JOIN public.profiles p ON p.id = l.creator_id
  LEFT JOIN public.event_category ec ON ec.id = l.category;
$$;

REVOKE ALL ON FUNCTION public.list_map_viewport(
  double precision, double precision, double precision, double precision, text, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_map_viewport(
  double precision, double precision, double precision, double precision, text, integer, boolean
) TO anon, authenticated, service_role;

COMMIT;
