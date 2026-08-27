-- SCRUM-120 — Community field corrections + duplicate reports on published events.
-- Applied on DEV (moments-locaux-dev / prymkgkafaovhzopslea) 2026-08-27.
-- UAT/prod: apply after human validation.
-- Mobile clients insert pending proposals only; accepting merges stays WebConsole / service_role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_correction_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  proposer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('field_correction', 'duplicate')),
  proposed_fields jsonb,
  duplicate_of_event_id uuid REFERENCES public.events (id) ON DELETE SET NULL,
  duplicate_hint text,
  source_hint text,
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  review_note text,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_correction_proposals_comment_len
    CHECK (char_length(btrim(comment)) BETWEEN 3 AND 2000),
  CONSTRAINT event_correction_proposals_duplicate_hint_len
    CHECK (duplicate_hint IS NULL OR char_length(btrim(duplicate_hint)) <= 500),
  CONSTRAINT event_correction_proposals_source_hint_len
    CHECK (source_hint IS NULL OR char_length(btrim(source_hint)) <= 500),
  CONSTRAINT event_correction_proposals_kind_shape CHECK (
    (
      kind = 'field_correction'
      AND proposed_fields IS NOT NULL
      AND jsonb_typeof(proposed_fields) = 'object'
      AND proposed_fields <> '{}'::jsonb
      AND duplicate_of_event_id IS NULL
      AND duplicate_hint IS NULL
    )
    OR (
      kind = 'duplicate'
      AND proposed_fields IS NULL
    )
  ),
  CONSTRAINT event_correction_proposals_no_self_duplicate
    CHECK (duplicate_of_event_id IS NULL OR duplicate_of_event_id <> event_id)
);

COMMENT ON TABLE public.event_correction_proposals IS
  'SCRUM-120: user proposals to correct published event fields or flag duplicates; applied only after admin accept.';

COMMENT ON COLUMN public.event_correction_proposals.proposed_fields IS
  'Partial event field diff for kind=field_correction (whitelist enforced by trigger).';

COMMENT ON COLUMN public.event_correction_proposals.duplicate_of_event_id IS
  'Optional UUID of the other published event when kind=duplicate.';

CREATE INDEX IF NOT EXISTS event_correction_proposals_event_id_idx
  ON public.event_correction_proposals (event_id);

CREATE INDEX IF NOT EXISTS event_correction_proposals_proposer_id_idx
  ON public.event_correction_proposals (proposer_id);

CREATE INDEX IF NOT EXISTS event_correction_proposals_status_created_idx
  ON public.event_correction_proposals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS event_correction_proposals_kind_status_idx
  ON public.event_correction_proposals (kind, status);

-- Soft anti-spam: max 5 proposals / authenticated user / UTC day.
CREATE OR REPLACE FUNCTION public.enforce_event_correction_proposal_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_limit integer := 5;
BEGIN
  SELECT count(*)::integer
  INTO v_count
  FROM public.event_correction_proposals
  WHERE proposer_id = NEW.proposer_id
    AND created_at >= date_trunc('day', timezone('utc', now()));

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'EVENT_CORRECTION_QUOTA_EXCEEDED'
      USING ERRCODE = 'P0001',
            HINT = format('Limit is %s proposals per UTC day.', v_limit);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_event_correction_proposal_quota() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.validate_event_correction_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_allowed text[] := ARRAY[
    'title',
    'description',
    'starts_at',
    'ends_at',
    'address',
    'city',
    'postal_code',
    'venue_name',
    'latitude',
    'longitude',
    'is_free',
    'price',
    'cover_url',
    'external_url'
  ];
  v_event_ok boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'EVENT_CORRECTION_STATUS_MUST_BE_PENDING' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.review_note IS NOT NULL THEN
      RAISE EXCEPTION 'EVENT_CORRECTION_REVIEW_FIELDS_FORBIDDEN_ON_INSERT' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.proposer_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_moderator()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'EVENT_CORRECTION_PROPOSER_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  -- Target visibility is enforced on insert only so moderators can still review
  -- after the event leaves published (archive / refuse).
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = NEW.event_id
        AND e.status = 'published'
        AND e.visibility = 'public'
    )
    INTO v_event_ok;

    IF NOT v_event_ok THEN
      RAISE EXCEPTION 'EVENT_CORRECTION_TARGET_NOT_PUBLISHED' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.kind = 'duplicate' AND NEW.duplicate_of_event_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = NEW.duplicate_of_event_id
          AND e.status = 'published'
          AND e.visibility = 'public'
      ) THEN
        RAISE EXCEPTION 'EVENT_CORRECTION_DUPLICATE_TARGET_INVALID' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF NEW.kind = 'field_correction' AND NEW.proposed_fields IS NOT NULL THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.proposed_fields)
    LOOP
      IF NOT (v_key = ANY (v_allowed)) THEN
        RAISE EXCEPTION 'EVENT_CORRECTION_FIELD_NOT_ALLOWED: %', v_key USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_event_correction_proposal() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_event_correction_proposals_quota
  ON public.event_correction_proposals;
CREATE TRIGGER trg_event_correction_proposals_quota
  BEFORE INSERT ON public.event_correction_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_correction_proposal_quota();

DROP TRIGGER IF EXISTS trg_event_correction_proposals_validate
  ON public.event_correction_proposals;
CREATE TRIGGER trg_event_correction_proposals_validate
  BEFORE INSERT OR UPDATE ON public.event_correction_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_event_correction_proposal();

ALTER TABLE public.event_correction_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_correction_proposals_insert_own
  ON public.event_correction_proposals;
CREATE POLICY event_correction_proposals_insert_own
  ON public.event_correction_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    proposer_id = auth.uid()
    AND status = 'pending'
    AND public.can_view_event(event_id)
  );

DROP POLICY IF EXISTS event_correction_proposals_select_own_or_mod
  ON public.event_correction_proposals;
CREATE POLICY event_correction_proposals_select_own_or_mod
  ON public.event_correction_proposals
  FOR SELECT
  TO authenticated
  USING (proposer_id = auth.uid() OR public.is_moderator());

-- Status / review writes: moderator or service_role (service_role bypasses RLS).
DROP POLICY IF EXISTS event_correction_proposals_update_mod
  ON public.event_correction_proposals;
CREATE POLICY event_correction_proposals_update_mod
  ON public.event_correction_proposals
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- No authenticated DELETE: cleanup via service_role / cascade on event/user.

GRANT SELECT, INSERT ON public.event_correction_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_correction_proposals TO service_role;

COMMIT;
