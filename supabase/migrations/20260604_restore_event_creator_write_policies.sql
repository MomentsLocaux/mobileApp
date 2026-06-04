BEGIN;

-- Follow-up for MVP-P0-004/P0-005.
-- P0-004 hardened event read access and replaced SELECT policies, but creator
-- write policies must remain present so MVP creation can insert draft/pending
-- rows before the lifecycle trigger validates transitions.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_profile_active(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user
      AND COALESCE(p.status::text, 'active') = 'active'
      AND (p.ban_until IS NULL OR p.ban_until <= now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_active(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS events_insert_creator ON public.events;
DROP POLICY IF EXISTS "events_insert_creator" ON public.events;
DROP POLICY IF EXISTS events_update_owner_or_mod ON public.events;
DROP POLICY IF EXISTS "events_update_owner_or_mod" ON public.events;
DROP POLICY IF EXISTS events_delete_owner_or_mod ON public.events;
DROP POLICY IF EXISTS "events_delete_owner_or_mod" ON public.events;

CREATE POLICY events_insert_creator
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY events_update_owner_or_mod
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  )
  WITH CHECK (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

CREATE POLICY events_delete_owner_or_mod
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    (
      auth.uid() = creator_id
      AND public.is_profile_active(auth.uid())
    )
    OR public.is_moderator()
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
