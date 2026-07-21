-- Contests schema V1: seasonal contest fields, entry moderation statuses,
-- one vote per user per contest (changeable), visible read RLS for clients.
-- Applied via Supabase MCP after human validation.

-- ---------------------------------------------------------------------------
-- 1) contests — additive columns + status check
-- ---------------------------------------------------------------------------

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS rules_md text,
  ADD COLUMN IF NOT EXISTS legal_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS voting_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS jury_announced_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_grid_meters integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.contests
SET voting_ends_at = end_at
WHERE voting_ends_at IS NULL;

ALTER TABLE public.contests
  ALTER COLUMN voting_ends_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contests_slug_key
  ON public.contests (slug)
  WHERE slug IS NOT NULL;

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_status_check;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'scheduled'::text,
    'open'::text,
    'voting_closed'::text,
    'closed'::text,
    'archived'::text
  ]));

ALTER TABLE public.contests
  DROP CONSTRAINT IF EXISTS contests_geo_grid_meters_check;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_geo_grid_meters_check
  CHECK (geo_grid_meters >= 100 AND geo_grid_meters <= 5000);

ALTER TABLE public.contests
  ALTER COLUMN status SET DEFAULT 'draft';

-- ---------------------------------------------------------------------------
-- 2) contest_entries — participation fields + pending/refused
-- ---------------------------------------------------------------------------

ALTER TABLE public.contest_entries
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS refusal_reason text,
  ADD COLUMN IF NOT EXISTS legal_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_version text,
  ADD COLUMN IF NOT EXISTS zone_lat double precision,
  ADD COLUMN IF NOT EXISTS zone_lng double precision,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.contest_entries
  DROP CONSTRAINT IF EXISTS contest_entries_status_check;

ALTER TABLE public.contest_entries
  ADD CONSTRAINT contest_entries_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'active'::text,
    'refused'::text,
    'hidden'::text,
    'removed'::text
  ]));

ALTER TABLE public.contest_entries
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.contest_entries
  DROP CONSTRAINT IF EXISTS contest_entries_zone_check;

ALTER TABLE public.contest_entries
  ADD CONSTRAINT contest_entries_zone_check
  CHECK (
    (zone_lat IS NULL AND zone_lng IS NULL)
    OR (
      zone_lat IS NOT NULL
      AND zone_lng IS NOT NULL
      AND zone_lat >= -90 AND zone_lat <= 90
      AND zone_lng >= -180 AND zone_lng <= 180
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Geo quantization helper (zone centroid, not precise pin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.quantize_contest_location(
  p_lat double precision,
  p_lng double precision,
  p_grid_meters integer DEFAULT 500
)
RETURNS TABLE (zone_lat double precision, zone_lng double precision)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_grid integer := GREATEST(100, LEAST(COALESCE(p_grid_meters, 500), 5000));
  -- Approximate degrees for a meter at mid-latitudes (good enough for zone display).
  v_lat_step double precision := v_grid / 111320.0;
  v_lng_step double precision;
  v_lat double precision;
  v_lng double precision;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    zone_lat := NULL;
    zone_lng := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'INVALID_COORDINATES';
  END IF;

  v_lng_step := v_grid / GREATEST(111320.0 * COS(radians(p_lat)), 1.0);
  v_lat := FLOOR(p_lat / v_lat_step) * v_lat_step + (v_lat_step / 2.0);
  v_lng := FLOOR(p_lng / v_lng_step) * v_lng_step + (v_lng_step / 2.0);

  zone_lat := ROUND(v_lat::numeric, 6)::double precision;
  zone_lng := ROUND(v_lng::numeric, 6)::double precision;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) contest_votes — 1 vote / user / contest (changeable)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS contest_votes_after_insert_trg ON public.contest_votes;
DROP TRIGGER IF EXISTS contest_votes_set_date_trg ON public.contest_votes;
DROP TRIGGER IF EXISTS contest_votes_validate_trg ON public.contest_votes;

ALTER TABLE public.contest_votes
  DROP CONSTRAINT IF EXISTS contest_votes_pkey;

DROP INDEX IF EXISTS contest_votes_entry_day_idx;

ALTER TABLE public.contest_votes
  DROP COLUMN IF EXISTS voted_on;

ALTER TABLE public.contest_votes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Keep at most one row per (contest_id, user_id). Empty table in DEV/UAT at write time.
DELETE FROM public.contest_votes a
USING public.contest_votes b
WHERE a.ctid < b.ctid
  AND a.contest_id = b.contest_id
  AND a.user_id = b.user_id;

ALTER TABLE public.contest_votes
  DROP CONSTRAINT IF EXISTS contest_votes_contest_user_key;

ALTER TABLE public.contest_votes
  ADD CONSTRAINT contest_votes_contest_user_key UNIQUE (contest_id, user_id);

CREATE OR REPLACE FUNCTION public.contest_votes_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_entry_contest uuid;
  v_status text;
  v_voting_ends_at timestamptz;
  v_entry_status text;
BEGIN
  SELECT user_id, contest_id, status
    INTO v_owner, v_entry_contest, v_entry_status
  FROM public.contest_entries
  WHERE id = NEW.entry_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'ENTRY_NOT_FOUND';
  END IF;

  IF v_entry_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'ENTRY_NOT_ACTIVE';
  END IF;

  IF v_owner = NEW.user_id THEN
    RAISE EXCEPTION 'CANNOT_VOTE_OWN_ENTRY';
  END IF;

  NEW.contest_id := v_entry_contest;

  IF TG_OP = 'UPDATE' AND NEW.contest_id IS DISTINCT FROM OLD.contest_id THEN
    RAISE EXCEPTION 'CANNOT_CHANGE_CONTEST';
  END IF;

  SELECT status, voting_ends_at
    INTO v_status, v_voting_ends_at
  FROM public.contests
  WHERE id = NEW.contest_id;

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'CONTEST_CLOSED';
  END IF;

  IF v_voting_ends_at IS NOT NULL AND now() > v_voting_ends_at THEN
    RAISE EXCEPTION 'VOTING_ENDED';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.contest_votes_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.contest_entries
  SET votes_count = votes_count + 1,
      updated_at = now()
  WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.contest_votes_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.entry_id IS DISTINCT FROM OLD.entry_id THEN
    UPDATE public.contest_entries
    SET votes_count = GREATEST(votes_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.entry_id;

    UPDATE public.contest_entries
    SET votes_count = votes_count + 1,
        updated_at = now()
    WHERE id = NEW.entry_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.contest_votes_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.contest_entries
  SET votes_count = GREATEST(votes_count - 1, 0),
      updated_at = now()
  WHERE id = OLD.entry_id;
  RETURN OLD;
END;
$$;

DROP FUNCTION IF EXISTS public.contest_votes_set_date();

CREATE TRIGGER contest_votes_validate_trg
  BEFORE INSERT OR UPDATE ON public.contest_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_votes_validate();

CREATE TRIGGER contest_votes_after_insert_trg
  AFTER INSERT ON public.contest_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_votes_after_insert();

CREATE TRIGGER contest_votes_after_update_trg
  AFTER UPDATE OF entry_id ON public.contest_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_votes_after_update();

CREATE TRIGGER contest_votes_after_delete_trg
  AFTER DELETE ON public.contest_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_votes_after_delete();

-- ---------------------------------------------------------------------------
-- 5) RPC — cast / change vote (1 per user per contest)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contests_cast_vote(
  p_contest_id uuid,
  p_entry_id uuid
)
RETURNS public.contest_votes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.contest_votes;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO public.contest_votes (contest_id, entry_id, user_id)
  VALUES (p_contest_id, p_entry_id, v_uid)
  ON CONFLICT (contest_id, user_id)
  DO UPDATE SET
    entry_id = EXCLUDED.entry_id,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.contests_cast_vote(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contests_cast_vote(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) RLS — visible read for authenticated clients (moderator policies kept)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS contests_select_visible ON public.contests;
CREATE POLICY contests_select_visible
  ON public.contests
  FOR SELECT
  TO authenticated
  USING (
    public.is_moderator()
    OR status = ANY (ARRAY[
      'scheduled'::text,
      'open'::text,
      'voting_closed'::text,
      'closed'::text
    ])
  );

DROP POLICY IF EXISTS contest_entries_select_visible ON public.contest_entries;
CREATE POLICY contest_entries_select_visible
  ON public.contest_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_moderator()
    OR status = 'active'
    OR user_id = auth.uid()
  );

ALTER TABLE public.contest_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_votes_select_own ON public.contest_votes;
CREATE POLICY contest_votes_select_own
  ON public.contest_votes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_moderator());

-- Writes go through contests_cast_vote (SECURITY DEFINER); no direct insert policy for users.
