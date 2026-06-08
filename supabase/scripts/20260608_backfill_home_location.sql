-- One-off backfill: seed user_preferences.home_location from each user's most
-- recent geolocated check-in, so the Lot 3 "nearby" notifications work for
-- already-active users before the client starts writing device location.
--
-- Safe / idempotent:
--   * only uses check-ins with a valid coordinate (ignores null and (0,0))
--   * never overwrites a home_location that is already set
--   * creates a preferences row with defaults when one does not exist yet
--
-- Device location (Lot 4/5) remains the source of truth going forward.

insert into public.user_preferences (user_id, home_location)
select user_id, loc
from (
    select distinct on (user_id)
        user_id,
        coalesce(
            location,
            case
                when lat is not null and lon is not null and not (lat = 0 and lon = 0)
                then st_setsrid(st_makepoint(lon, lat), 4326)::geography
            end
        ) as loc
    from public.event_checkins
    where location is not null
       or (lat is not null and lon is not null and not (lat = 0 and lon = 0))
    order by user_id, created_at desc
) last_loc
where loc is not null
on conflict (user_id) do update
    set home_location = excluded.home_location
    where public.user_preferences.home_location is null;
