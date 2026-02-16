-- Add invite role value to role_enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'role_enum'
      AND e.enumlabel = 'invite'
  ) THEN
    ALTER TYPE public.role_enum ADD VALUE 'invite';
  END IF;
END$$;
