-- DEV ONLY: seed fake profiles + future events + related data

-- 1) Seed profiles
CREATE TEMP TABLE temp_seed_profiles (
  id uuid,
  email text,
  password text,
  display_name text,
  role role_enum,
  city text,
  region text,
  avatar_url text,
  cover_url text
);

INSERT INTO temp_seed_profiles (id, email, password, display_name, role, city, region, avatar_url, cover_url)
SELECT
  gen_random_uuid(),
  'user' || gs || '@moments-locaux.test',
  'TestPass!2025',
  initcap(
    (ARRAY['alex','camille','sami','lea','noa','ines','julien','malo','emma','yanis','chloe','tom','lina','nina','maxime','lou','enzo','jade','paul','sarah'])[(floor(random() * 20) + 1)]
  ) || ' ' ||
  initcap(
    (ARRAY['martin','durand','bernard','petit','robert','richard','moreau','simon','laurent','lefebvre','michel','garcia','david','thomas','rodriguez','leroy','roux','vincent','fournier','andre'])[(floor(random() * 20) + 1)]
  ),
  (ARRAY['particulier','professionnel','institutionnel','invite','moderateur','admin'])[(floor(random() * 6) + 1)]::role_enum,
  (ARRAY['Paris','Lyon','Marseille','Bordeaux','Lille','Nantes','Toulouse','Nice','Rennes','Grenoble'])[(floor(random() * 10) + 1)],
  (ARRAY['Île-de-France','Auvergne-Rhône-Alpes','Provence-Alpes-Côte d’Azur','Nouvelle-Aquitaine','Hauts-de-France','Pays de la Loire','Occitanie','Bretagne'])[(floor(random() * 8) + 1)],
  'https://i.pravatar.cc/150?u=' || gs,
  'https://picsum.photos/seed/cover-' || gs || '/1200/600'
FROM generate_series(1, 50) gs;

-- Create auth users (for real credentials)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.instances) THEN
    INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), NULL, now(), now());
  END IF;
END$$;

WITH instance AS (
  SELECT id AS instance_id FROM auth.instances LIMIT 1
)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
SELECT
  p.id,
  i.instance_id,
  'authenticated',
  'authenticated',
  p.email,
  crypt(p.password, gen_salt('bf')),
  now(),
  now(),
  now()
FROM temp_seed_profiles p
CROSS JOIN instance i
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.id,
  p.id,
  jsonb_build_object('sub', p.id::text, 'email', p.email),
  'email',
  now(),
  now(),
  now()
FROM temp_seed_profiles p
JOIN auth.users u ON u.id = p.id
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (
  id,
  role,
  display_name,
  avatar_url,
  created_at,
  updated_at,
  bio,
  city,
  region,
  onboarding_completed,
  cover_url,
  facebook_url,
  instagram_url,
  tiktok_url
)
SELECT
  p.id,
  p.role,
  p.display_name,
  p.avatar_url,
  now(),
  now(),
  'Bio de ' || p.display_name,
  p.city,
  p.region,
  true,
  p.cover_url,
  NULL,
  NULL,
  NULL
FROM temp_seed_profiles p
JOIN auth.users u ON u.id = p.id;

DROP TABLE IF EXISTS temp_seed_profiles;
