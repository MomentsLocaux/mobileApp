-- SHOP-V1 — catalogue Boutique Lumo étendu (rayons dans data JSON).
-- Applied target: moments-locaux-dev after human/agent validation.
-- Upsert by key; does not delete existing items.

insert into public.shop_items (key, title, description, price, type, data)
values
  (
    'event_boost_72h',
    'Boost week-end',
    'Remonte ton événement 72h sur la carte et dans les listes.',
    240,
    'boost',
    '{"adr":"ADR_004","rayon":"visibility","effect":"event_visibility_boost","mechanism":"M9","duration_hours":72,"requires_can_create":true}'::jsonb
  ),
  (
    'community_highlight_7d',
    'Highlight communauté',
    'Mise en avant dans le feed / cercle pendant 7 jours.',
    60,
    'consumable',
    '{"adr":"ADR_004","rayon":"visibility","effect":"community_highlight","mechanism":"highlight","duration_days":7}'::jsonb
  ),
  (
    'pass_extra_stamp',
    'Tampon Pass bonus',
    '+1 tampon vers le Pass du mois (max 1 / mois).',
    80,
    'consumable',
    '{"adr":"ADR_004","rayon":"access","effect":"pass_extra_stamp","mechanism":"M5","cap_per_month":1}'::jsonb
  ),
  (
    'avatar_frame_eclaireur',
    'Cadre Éclaireur',
    'Cadre profil — réservé Habitué+ (idéal Éclaireur).',
    90,
    'skin',
    '{"adr":"ADR_004","rayon":"style","effect":"avatar_frame","mechanism":"M10","min_entitlement":"eclaireur"}'::jsonb
  )
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  price = excluded.price,
  type = excluded.type,
  data = excluded.data;

-- Annotate existing live items with rayon metadata
update public.shop_items
set data = coalesce(data, '{}'::jsonb) || '{"rayon":"visibility","requires_can_create":true}'::jsonb
where key = 'event_boost_24h';

update public.shop_items
set data = coalesce(data, '{}'::jsonb) || '{"rayon":"access"}'::jsonb
where key = 'early_access_unlock';

update public.shop_items
set data = coalesce(data, '{}'::jsonb) || '{"rayon":"style"}'::jsonb
where key = 'avatar_frame_local';
