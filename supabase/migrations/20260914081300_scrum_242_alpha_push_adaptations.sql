-- SCRUM-242 — Alpha push adaptations (product decisions 2026-09-14)
--
-- 1. "Ça commence bientôt" : seulement favoris / intérêt, plus l'organisateur
--    de chaque fiche scrapée.
-- 2. "Correctifs demandés" (tag needs_changes) → pas un refus en plus.
-- 3. Jobs Discovery push arrêtés (hors Alpha).
-- 4. Triggers métier Alpha ON ; fan-out catalogue, missions et concours OFF.
-- 5. skip_publish_fanout conservé (publication de masse).
--
-- Do not apply to production without human validation.

-- ---------------------------------------------------------------------------
-- 1) Event-soon recipients
-- ---------------------------------------------------------------------------
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
        select e.id as event_id, e.title, e.starts_at, ei.user_id
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

-- ---------------------------------------------------------------------------
-- 2) Status transition: request-changes ≠ refusal; keep mass-publish skip
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
  v_needs_changes boolean;
begin
  if current_setting('app.skip_publish_fanout', true) = 'on' then
    return new;
  end if;

  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_is_suggest := coalesce(new.submission_source, '') = 'community_suggest';
  v_needs_changes := coalesce(new.tags, array[]::text[]) @> array['needs_changes']::text[];

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
  elsif old.status = 'pending' and new.status = 'refused' and v_needs_changes then
    -- Console sendNotification already inserts event_request_changes.
    null;
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
      'Correctifs demandés',
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
-- 3) Stop Discovery push crons (Alpha)
-- ---------------------------------------------------------------------------
do $$
declare
  j record;
begin
  for j in
    select jobid, jobname
    from cron.job
    where jobname in (
      'discovery-push-opportunities',
      'discovery-life-insight-pushes'
    )
  loop
    perform cron.unschedule(j.jobid);
  end loop;
exception
  when undefined_table then
    null;
  when undefined_function then
    null;
end$$;

-- ---------------------------------------------------------------------------
-- 4) Social triggers present in repo (exist live, were created out of band)
-- ---------------------------------------------------------------------------
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row
  execute function public.notify_follow();

drop trigger if exists event_likes_notify on public.event_likes;
create trigger event_likes_notify
  after insert on public.event_likes
  for each row
  execute function public.notify_like();

-- ---------------------------------------------------------------------------
-- 5) Alpha ON / parked OFF (ignore missing triggers on fresh DBs)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('public.notifications', 'trg_notifications_push_dispatch', true),
      ('public.events', 'trg_events_notify_status', true),
      ('public.follows', 'follows_notify', true),
      ('public.event_likes', 'event_likes_notify', true),
      ('public.warnings', 'trg_warnings_notify_insert', true),
      ('public.profiles', 'trg_profiles_notify_ban', true),
      ('public.event_media_submissions', 'trg_event_media_submissions_notify_status', true),
      ('public.reports', 'trg_reports_notify_escalation', true),
      ('public.events', 'trg_events_notify_fanout', false),
      ('public.user_missions', 'user_missions_notify', false),
      ('public.contest_entries', 'trg_contest_entries_notify_status', false)
    ) as t(tbl, tg, turn_on)
  loop
    begin
      execute format(
        'alter table %s %s trigger %I',
        r.tbl,
        case when r.turn_on then 'enable' else 'disable' end,
        r.tg
      );
    exception
      when undefined_object then
        null;
    end;
  end loop;
end$$;

update public.app_config
set value = 'false'
where key = 'gamification_enabled';
