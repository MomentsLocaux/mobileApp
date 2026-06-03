BEGIN;

-- MVP-P0-004: enforce event visibility server-side for detail/deep-link/RPC access.

CREATE OR REPLACE FUNCTION public.can_view_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND (
        (e.visibility = 'public' AND e.status = 'published')
        OR e.creator_id = auth.uid()
        OR public.is_moderator()
        OR (
          e.visibility = 'prive'
          AND e.status = 'published'
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.notifications n
            WHERE n.user_id = auth.uid()
              AND n.data->>'kind' = 'private_invite'
              AND n.data->>'event_id' = e.id::text
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_event(uuid) TO anon, authenticated, service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_public ON public.events;
DROP POLICY IF EXISTS "events_select_public" ON public.events;
DROP POLICY IF EXISTS events_select_auth ON public.events;
DROP POLICY IF EXISTS "events_select_auth" ON public.events;

CREATE POLICY events_select_public
  ON public.events
  FOR SELECT
  TO anon
  USING (visibility = 'public' AND status = 'published');

CREATE POLICY events_select_auth
  ON public.events
  FOR SELECT
  TO authenticated
  USING (public.can_view_event(id));

CREATE OR REPLACE FUNCTION public.get_events_by_ids(ids uuid[])
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.events e
  WHERE array_length(ids, 1) IS NOT NULL
    AND e.id = ANY(ids)
    AND public.can_view_event(e.id)
  ORDER BY array_position(ids, e.id);
$$;

REVOKE ALL ON FUNCTION public.get_events_by_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_events_by_ids(uuid[]) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
