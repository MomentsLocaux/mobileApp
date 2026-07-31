-- MVP: list profiles who liked an event (bypasses event_likes owner-only RLS).
-- DO NOT apply without human validation (AGENTS.md). Apply DEV first, then UAT.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_event_likers(
  p_event_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(NULLIF(trim(p.display_name), ''), 'Membre')::text AS display_name,
    p.avatar_url::text AS avatar_url
  FROM public.event_likes el
  INNER JOIN public.profiles p ON p.id = el.user_id
  WHERE auth.uid() IS NOT NULL
    AND public.can_view_event(p_event_id)
    AND el.event_id = p_event_id
  ORDER BY el.created_at DESC NULLS LAST, p.display_name ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
$$;

REVOKE ALL ON FUNCTION public.list_event_likers(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_event_likers(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_event_likers(uuid, integer) TO authenticated, service_role;

COMMIT;
