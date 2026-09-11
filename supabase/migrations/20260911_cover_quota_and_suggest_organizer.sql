-- SCRUM-117 — Cover IA: 2 générations par brouillon.
-- SCRUM-108+ — Une suggestion communautaire n'en fait pas l'organisateur :
--   * pas de fan-out "followed_creator_published" (le suggester n'est pas orga)
--   * notif statut au contributeur reste (proposition publiée / refusée)
--
-- Human validation required before apply on DEV/UAT. Do not apply automatically.

-- ---------------------------------------------------------------------------
-- Cover generate quota (2 tries / draft_id)
-- ---------------------------------------------------------------------------
create table if not exists public.event_cover_generate_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_id uuid not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_id)
);

alter table public.event_cover_generate_usage enable row level security;

comment on table public.event_cover_generate_usage is
  'AI cover generations per user draft (default limit 2). Written by Edge Function generate-event-cover only.';

create or replace function public.consume_event_cover_generate_quota(
  p_user_id uuid,
  p_draft_id uuid,
  p_limit integer default 2
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_draft_id is null or coalesce(p_limit, 0) < 1 then
    return false;
  end if;

  insert into public.event_cover_generate_usage (user_id, draft_id, request_count, updated_at)
  values (p_user_id, p_draft_id, 1, now())
  on conflict (user_id, draft_id)
  do update
    set request_count = public.event_cover_generate_usage.request_count + 1,
        updated_at = now()
    where public.event_cover_generate_usage.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

create or replace function public.release_event_cover_generate_quota(
  p_user_id uuid,
  p_draft_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_cover_generate_usage
  set request_count = greatest(request_count - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and draft_id = p_draft_id
    and request_count > 0;
end;
$$;

revoke all on function public.consume_event_cover_generate_quota(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_event_cover_generate_quota(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_event_cover_generate_quota(uuid, uuid, integer) to service_role;
grant execute on function public.release_event_cover_generate_quota(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Contributor status copy (suggestion ≠ “votre événement organisateur”)
-- ---------------------------------------------------------------------------
create or replace function public.notify_event_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refusal_body text;
  v_is_suggest boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_is_suggest := coalesce(new.submission_source, '') = 'community_suggest';

  if old.status = 'pending' and new.status = 'published' then
    perform public.enqueue_notification(
      new.creator_id,
      'event_published',
      case when v_is_suggest then 'Proposition publiée' else 'Événement approuvé' end,
      case
        when v_is_suggest then 'Ta suggestion est visible. Moments Locaux en est l’organisateur.'
        else 'Votre événement est maintenant visible.'
      end,
      jsonb_build_object('eventId', new.id, 'status', new.status)
    );
  elsif old.status = 'pending' and new.status = 'refused' then
    v_refusal_body := coalesce(
      nullif(btrim(new.refusal_reason), ''),
      case
        when v_is_suggest then 'Ta suggestion n’a pas été validée.'
        else 'Votre événement n''a pas été validé.'
      end
    );
    perform public.enqueue_notification(
      new.creator_id,
      'event_refused',
      case when v_is_suggest then 'Proposition refusée' else 'Événement refusé' end,
      v_refusal_body,
      jsonb_build_object(
        'eventId', new.id,
        'status', new.status,
        'refusalReason', new.refusal_reason
      )
    );
  elsif old.status = 'pending' and new.status = 'draft' then
    perform public.enqueue_notification(
      new.creator_id,
      'event_request_changes',
      'Modifications demandées',
      coalesce(
        nullif(btrim(new.refusal_reason), ''),
        'La modération te demande des ajustements avant publication.'
      ),
      jsonb_build_object(
        'eventId', new.id,
        'status', new.status,
        'refusalReason', new.refusal_reason
      )
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fan-out: skip followed_creator_published for community_suggest
-- (based on 20260730_preference_center_push_enforcement.sql)
-- ---------------------------------------------------------------------------
create or replace function public.notify_event_published_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_became_published boolean;
  v_is_community_suggest boolean;
begin
  v_became_published :=
    new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published');

  if not v_became_published then
    return new;
  end if;

  if coalesce(new.visibility, 'public') = 'private' then
    return new;
  end if;

  v_is_community_suggest := coalesce(new.submission_source, '') = 'community_suggest';

  -- A) Followers of a real organizer — never the community suggester.
  if new.creator_id is not null and not v_is_community_suggest then
    insert into public.notifications (user_id, type, title, body, data)
    select
      f.follower,
      'followed_creator_published',
      coalesce(pr.display_name, 'Un créateur') || ' a publié un événement',
      new.title,
      jsonb_build_object('eventId', new.id, 'creatorId', new.creator_id)
    from public.follows f
    left join public.user_preferences up on up.user_id = f.follower
    left join public.profiles pr on pr.id = new.creator_id
    where f.following = new.creator_id
      and f.follower <> new.creator_id
      and coalesce(up.notify_followed_creator, true) = true
      and coalesce(up.notify_frequency, 'instant') = 'instant'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = f.follower
          and n.type = 'followed_creator_published'
          and n.data->>'eventId' = new.id::text
      );

    insert into public.notification_digest_queue (
      user_id, notification_type, title, body, data, digest_period
    )
    select
      f.follower,
      'followed_creator_published',
      coalesce(pr.display_name, 'Un créateur') || ' a publié un événement',
      new.title,
      jsonb_build_object('eventId', new.id, 'creatorId', new.creator_id),
      up.notify_frequency
    from public.follows f
    join public.user_preferences up on up.user_id = f.follower
    left join public.profiles pr on pr.id = new.creator_id
    where f.following = new.creator_id
      and f.follower <> new.creator_id
      and coalesce(up.notify_followed_creator, true) = true
      and coalesce(up.notify_frequency, 'instant') in ('daily', 'weekly')
      and not exists (
        select 1 from public.notification_digest_queue q
        where q.user_id = f.follower
          and q.notification_type = 'followed_creator_published'
          and q.data->>'eventId' = new.id::text
      );
  end if;

  if new.location is not null then
    insert into public.notifications (user_id, type, title, body, data)
    select
      up.user_id,
      'event_nearby_new',
      'Nouvel événement près de chez vous',
      new.title,
      jsonb_build_object('eventId', new.id, 'city', new.city)
    from public.user_preferences up
    where up.home_location is not null
      and coalesce(up.notify_event_nearby, true) = true
      and coalesce(up.notify_frequency, 'instant') = 'instant'
      and (new.creator_id is null or up.user_id <> new.creator_id)
      and st_dwithin(up.home_location, new.location, coalesce(up.notify_radius_km, 25) * 1000)
      and (
        cardinality(coalesce(up.preferred_category_slugs, '{}'::text[])) = 0
        or new.category is null
        or exists (
          select 1
          from public.event_category ec
          where ec.id = new.category
            and ec.slug = any (up.preferred_category_slugs)
        )
      )
      and (
        v_is_community_suggest
        or new.creator_id is null
        or not exists (
          select 1 from public.follows f
          where f.following = new.creator_id and f.follower = up.user_id
        )
      )
      and not exists (
        select 1 from public.notifications n
        where n.user_id = up.user_id
          and n.type = 'event_nearby_new'
          and n.data->>'eventId' = new.id::text
      );

    insert into public.notification_digest_queue (
      user_id, notification_type, title, body, data, digest_period
    )
    select
      up.user_id,
      'event_nearby_new',
      'Nouvel événement près de chez vous',
      new.title,
      jsonb_build_object('eventId', new.id, 'city', new.city),
      up.notify_frequency
    from public.user_preferences up
    where up.home_location is not null
      and coalesce(up.notify_event_nearby, true) = true
      and coalesce(up.notify_frequency, 'instant') in ('daily', 'weekly')
      and (new.creator_id is null or up.user_id <> new.creator_id)
      and st_dwithin(up.home_location, new.location, coalesce(up.notify_radius_km, 25) * 1000)
      and (
        cardinality(coalesce(up.preferred_category_slugs, '{}'::text[])) = 0
        or new.category is null
        or exists (
          select 1
          from public.event_category ec
          where ec.id = new.category
            and ec.slug = any (up.preferred_category_slugs)
        )
      )
      and (
        v_is_community_suggest
        or new.creator_id is null
        or not exists (
          select 1 from public.follows f
          where f.following = new.creator_id and f.follower = up.user_id
        )
      )
      and not exists (
        select 1 from public.notification_digest_queue q
        where q.user_id = up.user_id
          and q.notification_type = 'event_nearby_new'
          and q.data->>'eventId' = new.id::text
      );
  end if;

  return new;
end;
$$;
