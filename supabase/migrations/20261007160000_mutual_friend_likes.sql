-- Likes and saves of people you follow are visible only when they follow you back.
-- A profile's liked events are listed for that member, or for a mutual friend.
--
-- DO NOT apply without human validation (AGENTS.md). Apply DEV first, then UAT.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_event_liker_previews(
  p_event_ids uuid[],
  p_limit_per_event integer DEFAULT 5
)
RETURNS TABLE(
  event_id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  is_followed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT unnest(p_event_ids)::uuid AS event_id
  ),
  ranked AS (
    SELECT
      el.event_id,
      p.id AS user_id,
      COALESCE(NULLIF(trim(p.display_name), ''), 'Membre')::text AS display_name,
      p.avatar_url::text AS avatar_url,
      (
        EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower = auth.uid() AND f.following = p.id
        )
        AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower = p.id AND f.following = auth.uid()
        )
      ) AS is_followed,
      ROW_NUMBER() OVER (
        PARTITION BY el.event_id
        ORDER BY
          CASE
            WHEN EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower = auth.uid() AND f.following = p.id
            )
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower = p.id AND f.following = auth.uid()
            ) THEN 0
            ELSE 1
          END,
          CASE WHEN p.id IS NOT DISTINCT FROM auth.uid() THEN 0 ELSE 1 END,
          el.created_at DESC NULLS LAST
      ) AS rn
    FROM public.event_likes el
    INNER JOIN requested r ON r.event_id = el.event_id
    INNER JOIN public.profiles p ON p.id = el.user_id
    WHERE auth.uid() IS NOT NULL
      AND public.can_view_event(el.event_id)
      AND NOT (
        EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower = auth.uid() AND f.following = p.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower = p.id AND f.following = auth.uid()
        )
      )
  )
  SELECT
    ranked.event_id,
    ranked.user_id,
    ranked.display_name,
    ranked.avatar_url,
    ranked.is_followed
  FROM ranked
  WHERE ranked.rn <= GREATEST(1, LEAST(COALESCE(p_limit_per_event, 5), 8));
$$;

REVOKE ALL ON FUNCTION public.get_event_liker_previews(uuid[], integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_liker_previews(uuid[], integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_liker_previews(uuid[], integer) TO authenticated, service_role;

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
  WITH my_friends AS (
    SELECT f.following AS peer_id
    FROM public.follows f
    WHERE f.follower = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.follows back
        WHERE back.follower = f.following AND back.following = auth.uid()
      )
  ),
  engaged AS (
    SELECT el.user_id AS peer_id
    FROM public.event_likes el
    INNER JOIN my_friends mf ON mf.peer_id = el.user_id
    WHERE el.event_id = p_event_id
    UNION
    SELECT fav.profile_id AS peer_id
    FROM public.favorites fav
    INNER JOIN my_friends mf ON mf.peer_id = fav.profile_id
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

CREATE OR REPLACE FUNCTION public.get_event_friend_favorite_counts(event_ids uuid[])
RETURNS TABLE(event_id uuid, friends_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT unnest(event_ids)::uuid AS event_id
  ),
  my_friends AS (
    SELECT f.following AS profile_id
    FROM public.follows f
    WHERE f.follower = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.follows back
        WHERE back.follower = f.following AND back.following = auth.uid()
      )
  )
  SELECT
    r.event_id,
    COALESCE(COUNT(DISTINCT mf.profile_id), 0)::bigint AS friends_count
  FROM requested r
  LEFT JOIN public.favorites fav
    ON fav.event_id = r.event_id
  LEFT JOIN my_friends mf
    ON mf.profile_id = fav.profile_id
  WHERE public.can_view_event(r.event_id)
  GROUP BY r.event_id;
$$;

REVOKE ALL ON FUNCTION public.get_event_friend_favorite_counts(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_friend_favorite_counts(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_friend_favorite_counts(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_friend_liked_events(
  p_user_id uuid,
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  id uuid,
  title text,
  city text,
  starts_at timestamptz,
  cover_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.are_mutual_followers(auth.uid(), p_user_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.title::text,
    e.city::text,
    e.starts_at,
    e.cover_url::text
  FROM public.event_likes el
  INNER JOIN public.events e ON e.id = el.event_id
  WHERE el.user_id = p_user_id
    AND public.can_view_event(e.id)
  ORDER BY el.created_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.list_friend_liked_events(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_friend_liked_events(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_friend_liked_events(uuid, integer) TO authenticated, service_role;

COMMIT;
