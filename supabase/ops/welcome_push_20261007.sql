-- Welcome push for accounts that can actually receive a banner.
-- Project: moments-locaux-dev (prymkgkafaovhzopslea).
--
-- Audience: push_enabled, at least one device token, profile not banned.
-- Name: first word of display_name, first letter uppercase, rest lowercase.
--   dewi -> Dewi, Emma G -> Emma.
--
-- The SELECT below is safe. It only previews titles.
-- The INSERT is commented out on purpose: trg_notifications_push_dispatch
-- is enabled, so running it sends the banner immediately.
-- Idempotent on data.campaign = welcome_2026_10.
--
-- Tap target (next binary only; already-installed builds still open the inbox):
--   data.route = welcome | map | home | settings | notification_settings
--     | permissions | proposals | suggestions | favorites | profile
--     | community | agenda | messages | inbox
--   kind = welcome is the same as route = welcome.

-- 1. Preview
with eligible as (
  select distinct t.user_id, btrim(pr.display_name) as display_name
  from public.device_push_tokens t
  join public.profiles pr on pr.id = t.user_id
  left join public.user_preferences up on up.user_id = t.user_id
  where coalesce(up.push_enabled, true) = true
    and (pr.ban_until is null or pr.ban_until < now())
    and pr.status::text <> 'banned'
),
named as (
  select
    user_id,
    nullif(split_part(coalesce(display_name, ''), ' ', 1), '') as given_raw
  from eligible
)
select
  user_id,
  case
    when given_raw is null then 'Bienvenue sur Moments Locaux'
    else 'Bienvenue, ' || upper(left(given_raw, 1)) || lower(substr(given_raw, 2))
  end as title,
  'Des moments se préparent près de toi. Ouvre la carte et découvre ce qui se passe autour de toi.' as body
from named
order by title;

-- 2. Send (uncomment the whole statement, then run it once)
-- insert into public.notifications (user_id, type, title, body, data)
-- select
--   named.user_id,
--   'system',
--   case
--     when named.given_raw is null then 'Bienvenue sur Moments Locaux'
--     else 'Bienvenue, ' || upper(left(named.given_raw, 1)) || lower(substr(named.given_raw, 2))
--   end,
--   'Des moments se préparent près de toi. Ouvre la carte et découvre ce qui se passe autour de toi.',
--   jsonb_build_object('campaign', 'welcome_2026_10', 'kind', 'welcome', 'route', 'welcome')
-- from (
--   select
--     t.user_id,
--     nullif(split_part(btrim(coalesce(pr.display_name, '')), ' ', 1), '') as given_raw
--   from public.device_push_tokens t
--   join public.profiles pr on pr.id = t.user_id
--   left join public.user_preferences up on up.user_id = t.user_id
--   where coalesce(up.push_enabled, true) = true
--     and (pr.ban_until is null or pr.ban_until < now())
--     and pr.status::text <> 'banned'
--   group by t.user_id, pr.display_name
-- ) named
-- where not exists (
--   select 1
--   from public.notifications n
--   where n.user_id = named.user_id
--     and n.type = 'system'
--     and n.data->>'campaign' = 'welcome_2026_10'
-- );
