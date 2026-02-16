-- Enforce role enum on profiles (new typology + admin/moderateur)

-- 1) Create role enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
    CREATE TYPE public.role_enum AS ENUM (
      'particulier',
      'professionnel',
      'institutionnel',
      'moderateur',
      'admin'
    );
  END IF;
END$$;

-- 1b) Drop legacy role check constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END$$;

-- 2) Convert profiles.role to enum if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
      AND udt_name <> 'role_enum'
  ) THEN
    UPDATE public.profiles
    SET role = CASE role
      WHEN 'denicheur' THEN 'particulier'
      WHEN 'createur' THEN 'professionnel'
      WHEN 'moderateur' THEN 'moderateur'
      WHEN 'admin' THEN 'admin'
      ELSE 'particulier'
    END
    WHERE role IS NULL
       OR role NOT IN (
         'particulier',
         'professionnel',
         'institutionnel',
         'moderateur',
         'admin'
       );

    ALTER TABLE public.profiles
      ALTER COLUMN role DROP DEFAULT;

    ALTER TABLE public.profiles
      ALTER COLUMN role TYPE public.role_enum
      USING role::text::public.role_enum;

    ALTER TABLE public.profiles
      ALTER COLUMN role SET DEFAULT 'particulier';
  END IF;
END$$;
