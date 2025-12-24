-- Function to fetch multiple events by ids in one roundtrip (used for cluster expansion)
create or replace function public.get_events_by_ids(ids uuid[])
returns setof public.events
language sql
security definer
set search_path = public
as $$
  select *
  from public.events e
  where array_length(ids, 1) is not null
    and e.id = any(ids);
$$;

grant execute on function public.get_events_by_ids(uuid[]) to anon, authenticated, service_role;
