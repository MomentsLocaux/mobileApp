-- SCRUM-72 export RGPD · SCRUM-74 visibilité position · SCRUM-78 follows list
-- SCRUM-110 dédup pré-submit · SCRUM-36 leads Diffuseur
-- DO NOT apply without human validation (AGENTS.md). Apply DEV first, then UAT.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- SCRUM-74 — who can read home_location (default nobody = current behaviour)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS location_visibility text NOT NULL DEFAULT 'nobody';

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_location_visibility_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_location_visibility_check
  CHECK (location_visibility IN ('nobody', 'followers', 'public'));

COMMENT ON COLUMN public.user_preferences.location_visibility IS
  'Social visibility of home_location: nobody (default), followers, or public (authenticated). Nearby alerts still use home_location for the owner.';

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
  v_visibility text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  SELECT
    ST_Y(up.home_location::geometry),
    ST_X(up.home_location::geometry),
    COALESCE(up.location_visibility, 'nobody')
  INTO v_lat, v_lon, v_visibility
  FROM public.user_preferences up
  WHERE up.user_id = v_user_id
    AND up.home_location IS NOT NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_role IS NOT DISTINCT FROM 'service_role' OR auth.uid() IS NOT DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('lat', v_lat, 'lon', v_lon);
  END IF;

  IF v_visibility = 'public' AND auth.uid() IS NOT NULL THEN
    RETURN jsonb_build_object('lat', v_lat, 'lon', v_lon);
  END IF;

  IF v_visibility = 'followers'
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.follows f
       WHERE f.follower = auth.uid()
         AND f.following = v_user_id
     )
  THEN
    RETURN jsonb_build_object('lat', v_lat, 'lon', v_lon);
  END IF;

  RAISE EXCEPTION 'cannot read home location for another user' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_location_coords(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_location_coords(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SCRUM-78 — list followers / following for any profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_profile_follows(
  p_user_id uuid,
  p_direction text,
  p_limit integer DEFAULT 80
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(NULLIF(trim(p.display_name), ''), 'Membre')::text AS display_name,
    p.avatar_url::text AS avatar_url,
    p.city::text AS city
  FROM public.follows f
  INNER JOIN public.profiles p
    ON p.id = CASE
      WHEN lower(p_direction) = 'following' THEN f.following
      ELSE f.follower
    END
  WHERE auth.uid() IS NOT NULL
    AND p_user_id IS NOT NULL
    AND p.status = 'active'
    AND (
      CASE
        WHEN lower(p_direction) = 'following' THEN f.follower = p_user_id
        ELSE f.following = p_user_id
      END
    )
  ORDER BY p.display_name ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 80), 200));
$$;

REVOKE ALL ON FUNCTION public.list_profile_follows(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_profile_follows(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_profile_follows(uuid, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SCRUM-110 — pre-submit duplicates (pending + published, ±1 day, 500 m, title)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_event_submit_duplicates(
  p_title text,
  p_starts_at timestamptz,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer DEFAULT 500,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  starts_at timestamptz,
  city text,
  status text,
  distance_m double precision,
  title_score real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    e.title,
    e.starts_at,
    e.city,
    e.status::text,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m,
    similarity(lower(trim(e.title)), lower(trim(p_title))) AS title_score
  FROM public.events e
  WHERE e.status IN ('pending', 'published')
    AND (p_exclude_id IS NULL OR e.id <> p_exclude_id)
    AND e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND p_starts_at IS NOT NULL
    AND e.starts_at IS NOT NULL
    AND e.starts_at >= (p_starts_at - interval '1 day')
    AND e.starts_at <= (p_starts_at + interval '1 day')
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      GREATEST(50, LEAST(COALESCE(p_radius_m, 500), 2000))
    )
    AND length(trim(COALESCE(p_title, ''))) >= 3
    AND (
      similarity(lower(trim(e.title)), lower(trim(p_title))) >= 0.28
      OR lower(trim(e.title)) = lower(trim(p_title))
    )
  ORDER BY title_score DESC, distance_m ASC
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.find_event_submit_duplicates(text, timestamptz, double precision, double precision, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_event_submit_duplicates(text, timestamptz, double precision, double precision, integer, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SCRUM-72 — export request journal (artifact written by export-account function)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed', 'expired')),
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  expires_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS account_export_requests_user_created_idx
  ON public.account_export_requests (user_id, created_at DESC);

ALTER TABLE public.account_export_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_export_requests_select_own ON public.account_export_requests;
CREATE POLICY account_export_requests_select_own
  ON public.account_export_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-exports',
  'account-exports',
  false,
  10485760,
  ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- SCRUM-36 — Diffuseur captation leads (visible without FEATURE_DIFFUSEUR)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diffuseur_interest_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  city text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diffuseur_interest_leads_user_created_idx
  ON public.diffuseur_interest_leads (user_id, created_at DESC);

ALTER TABLE public.diffuseur_interest_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diffuseur_interest_leads_insert_own ON public.diffuseur_interest_leads;
CREATE POLICY diffuseur_interest_leads_insert_own
  ON public.diffuseur_interest_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS diffuseur_interest_leads_select_own ON public.diffuseur_interest_leads;
CREATE POLICY diffuseur_interest_leads_select_own
  ON public.diffuseur_interest_leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

COMMIT;
