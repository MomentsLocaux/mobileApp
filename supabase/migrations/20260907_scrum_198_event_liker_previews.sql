-- SCRUM-198 — EventCard liker avatars (follows first).
-- Batch preview for feed cards. Bypasses owner-only RLS on event_likes.
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
      EXISTS (
        SELECT 1
        FROM public.follows f
        WHERE f.follower = auth.uid()
          AND f.following = p.id
      ) AS is_followed,
      ROW_NUMBER() OVER (
        PARTITION BY el.event_id
        ORDER BY
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM public.follows f
              WHERE f.follower = auth.uid()
                AND f.following = p.id
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

COMMIT;
