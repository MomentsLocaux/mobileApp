-- SCRUM-152 — Allow category / subcategory on event_correction_proposals.proposed_fields.
-- Extends validate_event_correction_proposal() whitelist (SCRUM-120) with taxonomy UUID checks.
-- Applied on DEV (moments-locaux-dev / prymkgkafaovhzopslea) 2026-09-01.
-- UAT/prod: apply after human validation.
-- Apply merge remains WebConsole / service_role (ADR 001). When accepting a new category
-- without a matching subcategory in the payload, reset events.subcategory if it no longer
-- belongs to the new category.

BEGIN;

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
    'external_url',
    'category',
    'subcategory'
  ];
  v_event_ok boolean;
  v_uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_category uuid;
  v_subcategory uuid;
  v_effective_category uuid;
  v_json_type text;
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

    IF NEW.proposed_fields ? 'category' THEN
      v_json_type := jsonb_typeof(NEW.proposed_fields->'category');
      IF v_json_type IS DISTINCT FROM 'string'
         OR (NEW.proposed_fields->>'category') !~* v_uuid_re THEN
        RAISE EXCEPTION 'EVENT_CORRECTION_CATEGORY_INVALID' USING ERRCODE = 'P0001';
      END IF;
      v_category := (NEW.proposed_fields->>'category')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.event_category c WHERE c.id = v_category
      ) THEN
        RAISE EXCEPTION 'EVENT_CORRECTION_CATEGORY_UNKNOWN' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    IF NEW.proposed_fields ? 'subcategory' THEN
      v_json_type := jsonb_typeof(NEW.proposed_fields->'subcategory');
      IF v_json_type = 'null' THEN
        NULL;
      ELSIF v_json_type = 'string' AND (NEW.proposed_fields->>'subcategory') ~* v_uuid_re THEN
        v_subcategory := (NEW.proposed_fields->>'subcategory')::uuid;
        SELECT COALESCE(v_category, e.category)
        INTO v_effective_category
        FROM public.events e
        WHERE e.id = NEW.event_id;

        IF v_effective_category IS NULL THEN
          RAISE EXCEPTION 'EVENT_CORRECTION_SUBCATEGORY_WITHOUT_CATEGORY' USING ERRCODE = 'P0001';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.event_subcategory s
          WHERE s.id = v_subcategory
            AND s.category_id = v_effective_category
        ) THEN
          RAISE EXCEPTION 'EVENT_CORRECTION_SUBCATEGORY_MISMATCH' USING ERRCODE = 'P0001';
        END IF;
      ELSE
        RAISE EXCEPTION 'EVENT_CORRECTION_SUBCATEGORY_INVALID' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_event_correction_proposal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_event_correction_proposal() FROM anon, authenticated;

COMMENT ON COLUMN public.event_correction_proposals.proposed_fields IS
  'Partial event field diff for kind=field_correction. Whitelist + taxonomy UUID checks in validate_event_correction_proposal() (SCRUM-120 / SCRUM-152).';

COMMIT;
