-- Contest media bucket + rewards RLS + submit entry RPC for mobile clients.

-- ---------------------------------------------------------------------------
-- 1) Storage bucket contest-media
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contest-media',
  'contest-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS contest_media_public_read ON storage.objects;
CREATE POLICY contest_media_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'contest-media');

DROP POLICY IF EXISTS contest_media_moderator_write ON storage.objects;
CREATE POLICY contest_media_moderator_write
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'contest-media'
    AND public.is_moderator()
  )
  WITH CHECK (
    bucket_id = 'contest-media'
    AND public.is_moderator()
  );

DROP POLICY IF EXISTS contest_media_owner_insert ON storage.objects;
CREATE POLICY contest_media_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contest-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

DROP POLICY IF EXISTS contest_media_owner_update ON storage.objects;
CREATE POLICY contest_media_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contest-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[3] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'contest-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 2) contest_rewards — moderator manage + public read after announce
-- ---------------------------------------------------------------------------

ALTER TABLE public.contest_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_rewards_select_visible ON public.contest_rewards;
CREATE POLICY contest_rewards_select_visible
  ON public.contest_rewards
  FOR SELECT
  TO authenticated
  USING (
    public.is_moderator()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_rewards.contest_id
        AND c.jury_announced_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS contest_rewards_moderator_all ON public.contest_rewards;
CREATE POLICY contest_rewards_moderator_all
  ON public.contest_rewards
  FOR ALL
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- ---------------------------------------------------------------------------
-- 3) contests_submit_entry RPC (mobile participation)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contests_submit_entry(
  p_contest_id uuid,
  p_title text,
  p_content text,
  p_media_url text,
  p_storage_path text,
  p_legal_version text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS public.contest_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contest public.contests%ROWTYPE;
  v_zone record;
  v_row public.contest_entries;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTEST_NOT_FOUND';
  END IF;

  IF v_contest.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'CONTEST_NOT_OPEN';
  END IF;

  IF now() < v_contest.start_at OR now() > v_contest.end_at THEN
    RAISE EXCEPTION 'SUBMISSION_WINDOW_CLOSED';
  END IF;

  IF p_media_url IS NULL OR length(trim(p_media_url)) = 0 THEN
    RAISE EXCEPTION 'MEDIA_REQUIRED';
  END IF;

  IF p_legal_version IS NULL OR length(trim(p_legal_version)) = 0 THEN
    RAISE EXCEPTION 'LEGAL_REQUIRED';
  END IF;

  SELECT * INTO v_zone
  FROM public.quantize_contest_location(p_lat, p_lng, v_contest.geo_grid_meters);

  INSERT INTO public.contest_entries (
    contest_id,
    user_id,
    title,
    content,
    media_url,
    storage_path,
    status,
    legal_accepted_at,
    legal_version,
    zone_lat,
    zone_lng
  )
  VALUES (
    p_contest_id,
    v_uid,
    NULLIF(trim(COALESCE(p_title, '')), ''),
    NULLIF(trim(COALESCE(p_content, '')), ''),
    trim(p_media_url),
    NULLIF(trim(COALESCE(p_storage_path, '')), ''),
    'pending',
    now(),
    trim(p_legal_version),
    v_zone.zone_lat,
    v_zone.zone_lng
  )
  ON CONFLICT (contest_id, user_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    media_url = EXCLUDED.media_url,
    storage_path = EXCLUDED.storage_path,
    status = 'pending',
    refusal_reason = NULL,
    legal_accepted_at = now(),
    legal_version = EXCLUDED.legal_version,
    zone_lat = EXCLUDED.zone_lat,
    zone_lng = EXCLUDED.zone_lng,
    updated_at = now()
  WHERE public.contest_entries.status IN ('pending', 'refused')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'ENTRY_ALREADY_SUBMITTED';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.contests_submit_entry(uuid, text, text, text, text, text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contests_submit_entry(uuid, text, text, text, text, text, double precision, double precision) TO authenticated;

-- Allow owners to update their pending/refused entries (resubmit path via RPC mostly).
DROP POLICY IF EXISTS contest_entries_owner_insert ON public.contest_entries;
-- Inserts go through SECURITY DEFINER RPC; no direct insert policy for users.
