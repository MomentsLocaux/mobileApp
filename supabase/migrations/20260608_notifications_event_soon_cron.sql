-- Lot 6 — Notifications: scheduled "event starting soon" reminders.
--
-- A pg_cron job calls notify_events_starting_soon() periodically. For every
-- published event starting within the look-ahead window it notifies:
--   * the event creator
--   * users who marked interest (event_interests)
--   * users who favorited it (favorites)
-- gated by notify_event_reminders and idempotent per (user, event). Each
-- inserted notification is delivered to devices by the Lot 2 push trigger.

create extension if not exists pg_cron;

create or replace function public.notify_events_starting_soon(p_window_hours integer default 24)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    with horizon as (
        select now() as from_ts, now() + make_interval(hours => p_window_hours) as to_ts
    ),
    recipients as (
        select e.id as event_id, e.title, e.starts_at, e.creator_id as user_id
        from public.events e, horizon h
        where e.status = 'published'
          and e.creator_id is not null
          and e.starts_at > h.from_ts and e.starts_at <= h.to_ts
        union
        select e.id, e.title, e.starts_at, ei.user_id
        from public.events e
        join public.event_interests ei on ei.event_id = e.id, horizon h
        where e.status = 'published'
          and e.starts_at > h.from_ts and e.starts_at <= h.to_ts
        union
        select e.id, e.title, e.starts_at, f.profile_id
        from public.events e
        join public.favorites f on f.event_id = e.id, horizon h
        where e.status = 'published'
          and e.starts_at > h.from_ts and e.starts_at <= h.to_ts
    )
    insert into public.notifications (user_id, type, title, body, data)
    select
        r.user_id,
        'event_soon',
        'Événement à venir',
        r.title,
        jsonb_build_object('eventId', r.event_id, 'startsAt', r.starts_at)
    from recipients r
    left join public.user_preferences up on up.user_id = r.user_id
    where r.user_id is not null
      and coalesce(up.notify_event_reminders, true) = true
      and not exists (
          select 1 from public.notifications n
          where n.user_id = r.user_id
            and n.type = 'event_soon'
            and n.data->>'eventId' = r.event_id::text
      );

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

revoke all on function public.notify_events_starting_soon(integer) from public, anon, authenticated;

-- Schedule every 30 minutes (idempotent: replace any previous definition).
do $$
begin
    if exists (select 1 from cron.job where jobname = 'event-soon-reminders') then
        perform cron.unschedule('event-soon-reminders');
    end if;
end$$;

select cron.schedule(
    'event-soon-reminders',
    '*/30 * * * *',
    $job$ select public.notify_events_starting_soon(24); $job$
);
