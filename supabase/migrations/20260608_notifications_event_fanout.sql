-- Lot 3 — Notifications: event-published fan-out triggers.
--
-- Complements notify_event_status_transition() (which notifies the *creator*):
--   A. followed_creator_published -> followers of the event creator
--   B. event_nearby_new           -> users whose home_location is within their
--                                     notify_radius_km of the event location
--
-- Both fire only when an event *becomes* published, respect per-type
-- preferences + notify_frequency='instant', and are idempotent per (user,event).
-- Each inserted notification is delivered to devices by the Lot 2 push trigger.

-- 1) Per-user location used for radius matching (populated by the mobile client
--    in Lot 4/5). Until set, the nearby fan-out simply matches nobody.
alter table public.user_preferences
    add column if not exists home_location geography(Point, 4326);

comment on column public.user_preferences.home_location is
    'User reference point (WGS84) for geolocated "new nearby event" notifications. Populated from device location / onboarding.';

create index if not exists idx_user_preferences_home_location
    on public.user_preferences using gist (home_location);

-- 2) Fan-out function ---------------------------------------------------------
create or replace function public.notify_event_published_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_became_published boolean;
begin
    v_became_published :=
        new.status = 'published'
        and (tg_op = 'INSERT' or old.status is distinct from 'published');

    if not v_became_published then
        return new;
    end if;

    -- Skip private events from public fan-out.
    if coalesce(new.visibility, 'public') = 'private' then
        return new;
    end if;

    -- A) Followers of the creator -------------------------------------------
    if new.creator_id is not null then
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
    end if;

    -- B) Users near the event ------------------------------------------------
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
          -- avoid double-notifying followers (they already got case A)
          and (
              new.creator_id is null
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
    end if;

    return new;
end;
$$;

-- 3) Trigger ------------------------------------------------------------------
drop trigger if exists trg_events_notify_fanout on public.events;
create trigger trg_events_notify_fanout
    after insert or update of status on public.events
    for each row execute function public.notify_event_published_fanout();
