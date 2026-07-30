-- MVP peer social: list profiles among accounts the caller follows that liked
-- or favorited an event (bypasses event_likes / favorites owner-only RLS).
--
-- DO NOT apply without human validation (AGENTS.md). Apply DEV first, then UAT.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_event_engaged_by_following(
  p_event_id uuid,
  p_limit integer DEFAULT 6
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
  WITH my_follows AS (
    SELECT f.following AS peer_id
    FROM public.follows f
    WHERE f.follower = auth.uid()
  ),
  engaged AS (
    SELECT el.user_id AS peer_id
    FROM public.event_likes el
    INNER JOIN my_follows mf ON mf.peer_id = el.user_id
    WHERE el.event_id = p_event_id
    UNION
    SELECT fav.profile_id AS peer_id
    FROM public.favorites fav
    INNER JOIN my_follows mf ON mf.peer_id = fav.profile_id
    WHERE fav.event_id = p_event_id
  )
  SELECT
    p.id AS user_id,
    COALESCE(NULLIF(trim(p.display_name), ''), 'Membre')::text AS display_name,
    p.avatar_url::text AS avatar_url
  FROM engaged e
  INNER JOIN public.profiles p ON p.id = e.peer_id
  WHERE auth.uid() IS NOT NULL
    AND public.can_view_event(p_event_id)
    AND e.peer_id IS DISTINCT FROM auth.uid()
  ORDER BY p.display_name ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 24));
$$;

REVOKE ALL ON FUNCTION public.list_event_engaged_by_following(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_event_engaged_by_following(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_event_engaged_by_following(uuid, integer) TO authenticated, service_role;

COMMIT;
