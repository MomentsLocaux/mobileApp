BEGIN;

CREATE OR REPLACE FUNCTION public.is_profile_active(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user
      AND (
        p.status = 'active'
        OR (
          p.status IN ('restricted', 'suspended', 'banned')
          AND p.ban_until IS NOT NULL
          AND p.ban_until <= now()
        )
      )
  );
$$;

COMMIT;
