-- PostGIS powers user_preferences.home_location and nearby notification fan-out.
-- On Supabase, extension objects live in the "extensions" schema. SECURITY DEFINER
-- RPCs that cast to geography or call st_* must include that schema in search_path.

create extension if not exists postgis with schema extensions;

create or replace function public.set_home_location(p_lat double precision, p_lon double precision)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'not authenticated';
    end if;
    if p_lat is null or p_lon is null or (p_lat = 0 and p_lon = 0) then
        return;
    end if;

    insert into public.user_preferences (user_id, home_location)
    values (v_uid, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography)
    on conflict (user_id) do update
        set home_location = excluded.home_location,
            updated_at = now();
end;
$$;

revoke all on function public.set_home_location(double precision, double precision) from public, anon;
grant execute on function public.set_home_location(double precision, double precision) to authenticated;

create or replace function public.clear_home_location()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'not authenticated';
    end if;
    update public.user_preferences
        set home_location = null, updated_at = now()
        where user_id = v_uid;
end;
$$;

revoke all on function public.clear_home_location() from public, anon;
grant execute on function public.clear_home_location() to authenticated;
