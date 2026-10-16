-- Date corrections from the mobile sheet always include operating_hours
-- (and schedule_mode when the planner mode changes). The insert trigger on DEV
-- still rejected those keys (EVENT_CORRECTION_FIELD_NOT_ALLOWED), and
-- moderation_review_event_correction could not write them onto events.
-- operating_hours must be a JSON array or null: events_operating_hours_json.
-- schedule_mode accepts the mobile values (ponctuel, recurrent) and the
-- catalog value already stored on events (recurring).

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
    'operating_hours',
    'schedule_mode',
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

    IF NEW.proposed_fields ? 'schedule_mode' THEN
      v_json_type := jsonb_typeof(NEW.proposed_fields->'schedule_mode');
      IF v_json_type IS DISTINCT FROM 'string'
         OR (NEW.proposed_fields->>'schedule_mode') NOT IN ('ponctuel', 'recurrent', 'recurring') THEN
        RAISE EXCEPTION 'EVENT_CORRECTION_SCHEDULE_MODE_INVALID' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    IF NEW.proposed_fields ? 'operating_hours' THEN
      v_json_type := jsonb_typeof(NEW.proposed_fields->'operating_hours');
      IF v_json_type IS DISTINCT FROM 'null'
         AND v_json_type IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'EVENT_CORRECTION_OPERATING_HOURS_INVALID' USING ERRCODE = 'P0001';
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
  'Partial event field diff for kind=field_correction. User form: schedule (incl. operating_hours and schedule_mode), place, taxonomy, price. Legacy title/description/cover/url still accepted.';

CREATE OR REPLACE FUNCTION public.moderation_review_event_correction(
  p_proposal_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL::text,
  p_selected_fields text[] DEFAULT NULL::text[],
  p_duplicate_event_id uuid DEFAULT NULL::uuid,
  p_canonical_event_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_proposal public.event_correction_proposals%rowtype;
  v_selected_fields text[];
  v_allowed_fields constant text[] := array[
    'title',
    'description',
    'starts_at',
    'ends_at',
    'operating_hours',
    'schedule_mode',
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
  v_duplicate_event_id uuid;
  v_canonical_event_id uuid;
  v_archived_event_id uuid;
  v_event_count integer;
  v_action_type text;
  v_schedule_mode text;
  v_hours_type text;
begin
  if not (select public.is_moderator()) then
    raise exception 'MODERATOR_REQUIRED' using errcode = '42501';
  end if;

  if p_decision not in ('accept', 'reject') then
    raise exception 'INVALID_DECISION' using errcode = '22023';
  end if;

  if p_decision = 'reject' and char_length(btrim(coalesce(p_review_note, ''))) < 3 then
    raise exception 'REVIEW_NOTE_REQUIRED' using errcode = '22023';
  end if;

  select *
  into v_proposal
  from public.event_correction_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'PROPOSAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'PROPOSAL_ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  if p_decision = 'accept' and v_proposal.kind = 'field_correction' then
    select coalesce(array_agg(key order by key), array[]::text[])
    into v_selected_fields
    from jsonb_object_keys(v_proposal.proposed_fields) as key
    where p_selected_fields is null or key = any(p_selected_fields);

    if cardinality(v_selected_fields) = 0 then
      raise exception 'NO_FIELDS_SELECTED' using errcode = '22023';
    end if;

    if exists (
      select 1
      from unnest(v_selected_fields) as field
      where not (field = any(v_allowed_fields))
        or not (v_proposal.proposed_fields ? field)
    ) then
      raise exception 'INVALID_SELECTED_FIELD' using errcode = '22023';
    end if;

    if ('title' = any(v_selected_fields)
        and btrim(coalesce(v_proposal.proposed_fields ->> 'title', '')) = '')
      or ('description' = any(v_selected_fields)
        and btrim(coalesce(v_proposal.proposed_fields ->> 'description', '')) = '')
      or ('latitude' = any(v_selected_fields)
        and jsonb_typeof(v_proposal.proposed_fields -> 'latitude') = 'null')
      or ('longitude' = any(v_selected_fields)
        and jsonb_typeof(v_proposal.proposed_fields -> 'longitude') = 'null') then
      raise exception 'REQUIRED_EVENT_FIELD_CANNOT_BE_EMPTY' using errcode = '23502';
    end if;

    if 'schedule_mode' = any(v_selected_fields) then
      v_schedule_mode := v_proposal.proposed_fields ->> 'schedule_mode';
      if v_schedule_mode is null or v_schedule_mode not in ('ponctuel', 'recurrent', 'recurring') then
        raise exception 'EVENT_CORRECTION_SCHEDULE_MODE_INVALID' using errcode = '22023';
      end if;
    end if;

    if 'operating_hours' = any(v_selected_fields) then
      v_hours_type := jsonb_typeof(v_proposal.proposed_fields -> 'operating_hours');
      if v_hours_type is distinct from 'null' and v_hours_type is distinct from 'array' then
        raise exception 'EVENT_CORRECTION_OPERATING_HOURS_INVALID' using errcode = '22023';
      end if;
    end if;

    update public.events
    set
      title = case when 'title' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'title' else title end,
      description = case when 'description' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'description' else description end,
      starts_at = case when 'starts_at' = any(v_selected_fields)
        then case when jsonb_typeof(v_proposal.proposed_fields -> 'starts_at') = 'null'
          then null else (v_proposal.proposed_fields ->> 'starts_at')::timestamptz end
        else starts_at end,
      ends_at = case when 'ends_at' = any(v_selected_fields)
        then case when jsonb_typeof(v_proposal.proposed_fields -> 'ends_at') = 'null'
          then null else (v_proposal.proposed_fields ->> 'ends_at')::timestamptz end
        else ends_at end,
      operating_hours = case when 'operating_hours' = any(v_selected_fields)
        then case when jsonb_typeof(v_proposal.proposed_fields -> 'operating_hours') = 'null'
          then null else v_proposal.proposed_fields -> 'operating_hours' end
        else operating_hours end,
      schedule_mode = case when 'schedule_mode' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'schedule_mode' else schedule_mode end,
      address = case when 'address' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'address' else address end,
      city = case when 'city' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'city' else city end,
      postal_code = case when 'postal_code' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'postal_code' else postal_code end,
      venue_name = case when 'venue_name' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'venue_name' else venue_name end,
      latitude = case when 'latitude' = any(v_selected_fields)
        then (v_proposal.proposed_fields ->> 'latitude')::double precision else latitude end,
      longitude = case when 'longitude' = any(v_selected_fields)
        then (v_proposal.proposed_fields ->> 'longitude')::double precision else longitude end,
      is_free = case when 'is_free' = any(v_selected_fields)
        then case when jsonb_typeof(v_proposal.proposed_fields -> 'is_free') = 'null'
          then null else (v_proposal.proposed_fields ->> 'is_free')::boolean end
        else is_free end,
      price = case when 'price' = any(v_selected_fields)
        then case when jsonb_typeof(v_proposal.proposed_fields -> 'price') = 'null'
          then null else (v_proposal.proposed_fields ->> 'price')::numeric end
        else price end,
      cover_url = case when 'cover_url' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'cover_url' else cover_url end,
      external_url = case when 'external_url' = any(v_selected_fields)
        then v_proposal.proposed_fields ->> 'external_url' else external_url end,
      updated_at = now()
    where id = v_proposal.event_id
      and status = 'published';

    if not found then
      raise exception 'TARGET_EVENT_NOT_PUBLISHED' using errcode = 'P0001';
    end if;

    v_action_type := 'request_changes';
  elsif p_decision = 'accept' and v_proposal.kind = 'duplicate' then
    v_duplicate_event_id := coalesce(p_duplicate_event_id, v_proposal.duplicate_of_event_id);
    if v_duplicate_event_id is null or v_duplicate_event_id = v_proposal.event_id then
      raise exception 'DUPLICATE_TARGET_REQUIRED' using errcode = '22023';
    end if;

    v_canonical_event_id := coalesce(p_canonical_event_id, v_proposal.event_id);
    if v_canonical_event_id not in (v_proposal.event_id, v_duplicate_event_id) then
      raise exception 'INVALID_CANONICAL_EVENT' using errcode = '22023';
    end if;
    v_archived_event_id := case
      when v_canonical_event_id = v_proposal.event_id then v_duplicate_event_id
      else v_proposal.event_id
    end;

    -- Stable lock ordering avoids deadlocks when two moderators review the same pair.
    perform 1
    from public.events
    where id = any(array[v_proposal.event_id, v_duplicate_event_id])
    order by id
    for update;

    select count(*)::integer
    into v_event_count
    from public.events
    where id = any(array[v_proposal.event_id, v_duplicate_event_id])
      and status = 'published'
      and visibility = 'public';
    if v_event_count <> 2 then
      raise exception 'DUPLICATE_EVENTS_MUST_BE_PUBLIC_AND_PUBLISHED' using errcode = 'P0001';
    end if;

    -- Warehouse split: skip if the scrape table is not on this database.
    if to_regclass('public.event_source_occurrence') is not null then
      update public.event_source_occurrence
      set canonical_event_id = v_canonical_event_id,
          updated_at = now()
      where canonical_event_id = v_archived_event_id;
    end if;

    update public.events
    set status = 'archived',
        updated_at = now()
    where id = v_archived_event_id;

    update public.event_correction_proposals
    set duplicate_of_event_id = v_duplicate_event_id
    where id = v_proposal.id;

    v_action_type := 'archive';
  else
    v_selected_fields := null;
    v_action_type := 'refuse';
  end if;

  update public.event_correction_proposals
  set status = case when p_decision = 'accept' then 'accepted' else 'rejected' end,
      review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = v_proposal.id;

  insert into public.moderation_actions (
    target_type,
    target_id,
    action_type,
    moderator_id,
    metadata
  ) values (
    'event',
    coalesce(v_archived_event_id, v_proposal.event_id),
    v_action_type,
    auth.uid(),
    jsonb_strip_nulls(jsonb_build_object(
      'action', 'review_event_correction_proposal',
      'proposal_id', v_proposal.id,
      'proposal_kind', v_proposal.kind,
      'decision', p_decision,
      'selected_fields', to_jsonb(v_selected_fields),
      'canonical_event_id', v_canonical_event_id,
      'archived_event_id', v_archived_event_id,
      'review_note', nullif(btrim(coalesce(p_review_note, '')), '')
    ))
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_proposal.proposer_id,
    'system',
    case
      when v_proposal.kind = 'duplicate' and p_decision = 'accept' then 'Doublon confirmé'
      when v_proposal.kind = 'duplicate' then 'Signalement de doublon refusé'
      when p_decision = 'accept' then 'Correction acceptée'
      else 'Correction refusée'
    end,
    case
      when p_decision = 'accept' then 'Merci, ta contribution a été vérifiée par la modération.'
      else coalesce(nullif(btrim(p_review_note), ''), 'La proposition n’a pas été retenue.')
    end,
    jsonb_build_object(
      'kind', 'event_correction_review',
      'proposal_id', v_proposal.id,
      'event_id', v_proposal.event_id,
      'decision', p_decision
    )
  );

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'status', case when p_decision = 'accept' then 'accepted' else 'rejected' end,
    'canonical_event_id', v_canonical_event_id,
    'archived_event_id', v_archived_event_id
  );
end;
$function$;

COMMENT ON FUNCTION public.moderation_review_event_correction(uuid, text, text, text[], uuid, uuid) IS
  'Moderator review of event_correction_proposals. Field accept writes schedule fields (starts_at, ends_at, operating_hours, schedule_mode) as well as place and price. Duplicate accept archives the extra event; occurrence repoint is skipped when event_source_occurrence is absent.';
