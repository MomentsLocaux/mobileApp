-- Aggregated event views counts for cards/listing.
-- Returns one row per requested event_id with a 0 default.
create or replace function public.get_event_views_counts(event_ids uuid[])
returns table(event_id uuid, views_count bigint)
language sql
security definer
set search_path = public
as $$
  with requested as (
    select unnest(event_ids)::uuid as event_id
  ),
  aggregated as (
    select ev.event_id, count(*)::bigint as views_count
    from public.event_views ev
    where ev.event_id = any(event_ids)
    group by ev.event_id
  )
  select r.event_id, coalesce(a.views_count, 0)::bigint as views_count
  from requested r
  left join aggregated a on a.event_id = r.event_id
  where array_length(event_ids, 1) is not null;
$$;

grant execute on function public.get_event_views_counts(uuid[]) to anon, authenticated, service_role;
