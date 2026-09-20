-- After 20260914_dev_drop_scrape_warehouse_keep_events, public.event_source_occurrence
-- lives on ingest-dev, not on the product DB. Accepting a community duplicate still
-- archives the extra published event; the occurrence repoint is skipped when the
-- table is absent (to_regclass). Do not recreate the warehouse on product.

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
  'Moderator review of event_correction_proposals. Duplicate accept archives the extra event; occurrence repoint is skipped when event_source_occurrence is absent.';
