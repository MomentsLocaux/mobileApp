-- DEV ONLY: seed fake future events + related data

CREATE TEMP TABLE temp_seed_events (
  id uuid,
  creator_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
);

CREATE TEMP TABLE temp_seed_cities (
  city text,
  region text,
  postal_prefix text,
  venue_name text,
  base_lat double precision,
  base_lon double precision
);

INSERT INTO temp_seed_cities (city, region, postal_prefix, venue_name, base_lat, base_lon)
VALUES
  ('Paris', 'Île-de-France', '750', 'Le Passage', 48.8566, 2.3522),
  ('Lyon', 'Auvergne-Rhône-Alpes', '690', 'La Verrière', 45.7640, 4.8357),
  ('Marseille', 'Provence-Alpes-Côte d’Azur', '130', 'Le Panier', 43.2965, 5.3698),
  ('Bordeaux', 'Nouvelle-Aquitaine', '330', 'La Fabrique', 44.8412, -0.5796),
  ('Lille', 'Hauts-de-France', '590', 'La Halle', 50.6311, 3.0616),
  ('Nantes', 'Pays de la Loire', '440', 'Le Loft', 47.2173, -1.5534),
  ('Toulouse', 'Occitanie', '310', 'Le Hangar', 43.6047, 1.4442),
  ('Nice', 'Provence-Alpes-Côte d’Azur', '060', 'La Scène', 43.7009, 7.2683),
  ('Rennes', 'Bretagne', '350', 'Le Jardin', 48.1173, -1.6778),
  ('Grenoble', 'Auvergne-Rhône-Alpes', '380', 'La Verrière', 45.1885, 5.7245);

CREATE TEMP TABLE temp_seed_locations (
  id int,
  city text,
  region text,
  postal_code text,
  address text,
  venue_name text,
  latitude double precision,
  longitude double precision
);

INSERT INTO temp_seed_locations (id, city, region, postal_code, address, venue_name, latitude, longitude)
SELECT
  gs,
  c.city,
  c.region,
  c.postal_prefix || lpad(((gs % 90) + 10)::text, 2, '0'),
  ((gs % 200) + 1)::text || ' ' ||
    (ARRAY[
      'Rue de la République',
      'Rue Victor Hugo',
      'Rue Nationale',
      'Rue de la Paix',
      'Avenue Jean Jaurès',
      'Rue des Fleurs',
      'Rue du Château',
      'Rue Saint-Georges',
      'Rue du Port',
      'Avenue de la Gare'
    ])[(floor(random() * 10) + 1)],
  c.venue_name,
  c.base_lat + (random() - 0.5) * 0.02,
  c.base_lon + (random() - 0.5) * 0.02
FROM generate_series(1, 200) gs
JOIN LATERAL (
  SELECT *
  FROM temp_seed_cities
  ORDER BY random()
  LIMIT 1
) c ON true;

INSERT INTO public.events (
  id,
  creator_id,
  title,
  description,
  tags,
  is_free,
  ambiance,
  starts_at,
  ends_at,
  latitude,
  longitude,
  visibility,
  status,
  created_at,
  address,
  cover_url,
  city,
  postal_code,
  venue_name,
  registration_required,
  max_participants,
  external_url,
  contact_email,
  contact_phone,
  price,
  schedule_mode,
  updated_at,
  category,
  subcategory,
  location
)
SELECT
  gen_random_uuid(),
  p.id,
  CASE cat.slug
    WHEN 'arts-culture' THEN
      (ARRAY['Soirée théâtre', 'Expo photo', 'Concert acoustique', 'Projection plein air'])[(floor(random() * 4) + 1)] || ' à ' || loc.city
    WHEN 'marches-artisanat' THEN
      (ARRAY['Marché local', 'Salon des créateurs', 'Brocante artisanale'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'fetes-animations' THEN
      (ARRAY['Fête de quartier', 'Bal populaire', 'Soirée DJ'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'famille-enfants' THEN
      (ARRAY['Atelier enfants', 'Spectacle familial', 'Jeux en plein air'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'gastronomie-saveurs' THEN
      (ARRAY['Dégustation locale', 'Atelier cuisine', 'Marché gourmand'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'nature-bienetre' THEN
      (ARRAY['Balade nature', 'Yoga au parc', 'Atelier bien-être'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'ateliers-apprentissage' THEN
      (ARRAY['Atelier découverte', 'Cours créatif', 'Initiation pratique'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'sport-loisirs' THEN
      (ARRAY['Tournoi amical', 'Sortie sportive', 'Initiation loisirs'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'vie-locale' THEN
      (ARRAY['Rencontre citoyenne', 'Forum local', 'Café associatif'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    WHEN 'insolite-ephemere' THEN
      (ARRAY['Expérience éphémère', 'Pop‑up surprise', 'Lieu secret'])[(floor(random() * 3) + 1)] || ' à ' || loc.city
    ELSE 'Événement à ' || loc.city
  END,
  'Description de l’événement ' || gs || ' (test).',
  COALESCE(
    (SELECT array_agg(t.slug) FROM (
      SELECT slug FROM public.event_tag ORDER BY random() LIMIT (1 + (random() * 3)::int)
    ) t),
    '{}'::text[]
  ),
  (random() < 0.6),
  (ARRAY['convivial','familial','festif','culturel','sportif','détente'])[(floor(random() * 6) + 1)],
  (now() + ((random() * 45)::int + 1) * interval '1 day' + (random() * 10)::int * interval '1 hour'),
  (now() + ((random() * 45)::int + 1) * interval '1 day' + ((random() * 10)::int + 2) * interval '1 hour'),
  loc.latitude,
  loc.longitude,
  'public',
  'published',
  now(),
  loc.address,
  (ARRAY[
    'https://picsum.photos/seed/event-' || gs || '/1200/800',
    'https://placehold.co/1200x800?text=Moments+Locaux',
    'https://source.unsplash.com/featured/1200x800?event,city'
  ])[(floor(random() * 3) + 1)],
  loc.city,
  loc.postal_code,
  loc.venue_name,
  (random() < 0.3),
  (ARRAY[null, 30, 50, 100, 200])[(floor(random() * 5) + 1)],
  NULL,
  NULL,
  NULL,
  CASE WHEN random() < 0.6 THEN NULL ELSE (random() * 25)::int END,
  'ponctuel',
  now(),
  cat.id,
  sub.id,
  ST_SetSRID(ST_MakePoint(loc.longitude, loc.latitude), 4326)::geography
FROM generate_series(1, 200) gs
CROSS JOIN LATERAL (SELECT id FROM public.profiles ORDER BY random() LIMIT 1) p
JOIN temp_seed_locations loc ON loc.id = gs
CROSS JOIN LATERAL (
  SELECT id, slug
  FROM public.event_category
  ORDER BY random()
  LIMIT 1
) cat
CROSS JOIN LATERAL (
  SELECT id
  FROM public.event_subcategory
  WHERE category_id = cat.id
  ORDER BY random()
  LIMIT 1
) sub
RETURNING id, creator_id, starts_at, ends_at;

INSERT INTO temp_seed_events (id, creator_id, starts_at, ends_at)
SELECT id, creator_id, starts_at, ends_at
FROM public.events
ORDER BY created_at DESC
LIMIT 200;

-- Media
INSERT INTO public.event_media (id, event_id, url, position, type, "order", created_at)
SELECT
  gen_random_uuid(),
  e.id,
  (ARRAY[
    'https://picsum.photos/seed/' || e.id || '-' || idx || '/1200/800',
    'https://placehold.co/1200x800?text=Moments+Locaux',
    'https://source.unsplash.com/featured/1200x800?festival,people'
  ])[(floor(random() * 3) + 1)],
  idx - 1,
  'image',
  idx - 1,
  now()
FROM temp_seed_events e
CROSS JOIN LATERAL generate_series(1, (1 + (random() * 2)::int)) AS idx;

-- Comments
INSERT INTO public.event_comments (id, event_id, author_id, message, created_at, updated_at)
SELECT
  gen_random_uuid(),
  e.id,
  p.id,
  (ARRAY[
    'Super idée !',
    'Hâte d’y être 😊',
    'Ça a l’air génial.',
    'Je viens avec des amis.',
    'Quelqu’un y va ?'
  ])[(floor(random() * 5) + 1)],
  now(),
  now()
FROM (
  SELECT id FROM temp_seed_events ORDER BY random() LIMIT 120
) e
CROSS JOIN LATERAL (SELECT id FROM public.profiles ORDER BY random() LIMIT 1) p;

-- Likes & interests
INSERT INTO public.event_likes (user_id, event_id, created_at)
SELECT p.id, e.id, now()
FROM public.profiles p
CROSS JOIN temp_seed_events e
ORDER BY random()
LIMIT 200;

INSERT INTO public.event_interests (user_id, event_id, created_at)
SELECT p.id, e.id, now()
FROM public.profiles p
CROSS JOIN temp_seed_events e
ORDER BY random()
LIMIT 200;

DROP TABLE IF EXISTS temp_seed_events;
DROP TABLE IF EXISTS temp_seed_locations;
DROP TABLE IF EXISTS temp_seed_cities;
