BEGIN;

-- MVP-P0-003: tighten direct access to behavioral and private tables.
-- This migration is intended to be reviewed and applied in staging before prod.

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
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_event(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- event_checkins: raw presence/location rows are private.
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all check-ins" ON public.event_checkins;
DROP POLICY IF EXISTS event_checkins_select_public ON public.event_checkins;
DROP POLICY IF EXISTS "event_checkins_select_public" ON public.event_checkins;
DROP POLICY IF EXISTS "Users can view their own check-ins" ON public.event_checkins;
DROP POLICY IF EXISTS event_checkins_select_own ON public.event_checkins;
DROP POLICY IF EXISTS "event_checkins_select_own" ON public.event_checkins;
DROP POLICY IF EXISTS "Users can check-in to events" ON public.event_checkins;
DROP POLICY IF EXISTS event_checkins_insert_own ON public.event_checkins;
DROP POLICY IF EXISTS "event_checkins_insert_own" ON public.event_checkins;

CREATE POLICY event_checkins_select_own
  ON public.event_checkins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No authenticated INSERT policy by design: check-in writes must go through the
-- event-checkin Edge Function, which uses service_role after distance/QR checks.

-- ---------------------------------------------------------------------------
-- event_views: no direct read; public counts are exposed through RPC only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_views_select_public ON public.event_views;
DROP POLICY IF EXISTS "event_views_select_public" ON public.event_views;
DROP POLICY IF EXISTS event_views_select_auth ON public.event_views;
DROP POLICY IF EXISTS "event_views_select_auth" ON public.event_views;
DROP POLICY IF EXISTS event_views_insert_public_visible ON public.event_views;
DROP POLICY IF EXISTS "event_views_insert_public_visible" ON public.event_views;

CREATE POLICY event_views_insert_public_visible
  ON public.event_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (profile_id IS NULL OR profile_id = auth.uid())
    AND public.can_view_event(event_id)
  );

-- ---------------------------------------------------------------------------
-- event_likes: raw social graph is private; owner can manage own likes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_likes_select_public ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_select_public" ON public.event_likes;
DROP POLICY IF EXISTS event_likes_select_auth ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_select_auth" ON public.event_likes;
DROP POLICY IF EXISTS event_likes_select_own ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_select_own" ON public.event_likes;
DROP POLICY IF EXISTS event_likes_insert_own ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_insert_own" ON public.event_likes;
DROP POLICY IF EXISTS event_likes_delete_own ON public.event_likes;
DROP POLICY IF EXISTS "event_likes_delete_own" ON public.event_likes;

CREATE POLICY event_likes_select_own
  ON public.event_likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY event_likes_insert_own
  ON public.event_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY event_likes_delete_own
  ON public.event_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- favorites: owner-only rows. Public/friend aggregates must go through RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_select_public ON public.favorites;
DROP POLICY IF EXISTS "favorites_select_public" ON public.favorites;
DROP POLICY IF EXISTS favorites_select_auth ON public.favorites;
DROP POLICY IF EXISTS "favorites_select_auth" ON public.favorites;
DROP POLICY IF EXISTS favorites_select_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
DROP POLICY IF EXISTS favorites_insert_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
DROP POLICY IF EXISTS favorites_delete_own ON public.favorites;
DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;

CREATE POLICY favorites_select_own
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY favorites_insert_own
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY favorites_delete_own
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- follows: users can see only their own follower/following rows.
-- ---------------------------------------------------------------------------

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select_public ON public.follows;
DROP POLICY IF EXISTS "follows_select_public" ON public.follows;
DROP POLICY IF EXISTS follows_select_auth ON public.follows;
DROP POLICY IF EXISTS "follows_select_auth" ON public.follows;
DROP POLICY IF EXISTS follows_select_own_graph ON public.follows;
DROP POLICY IF EXISTS "follows_select_own_graph" ON public.follows;
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;

CREATE POLICY follows_select_own_graph
  ON public.follows
  FOR SELECT
  TO authenticated
  USING (auth.uid() = follower OR auth.uid() = following);

CREATE POLICY follows_insert_own
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower);

CREATE POLICY follows_delete_own
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower);

-- ---------------------------------------------------------------------------
-- reports: user can submit; read/update is moderator/web-admin only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_public ON public.reports;
DROP POLICY IF EXISTS "reports_select_public" ON public.reports;
DROP POLICY IF EXISTS reports_select_auth ON public.reports;
DROP POLICY IF EXISTS "reports_select_auth" ON public.reports;
DROP POLICY IF EXISTS reports_insert_auth ON public.reports;
DROP POLICY IF EXISTS "reports_insert_auth" ON public.reports;
DROP POLICY IF EXISTS reports_insert_user ON public.reports;
DROP POLICY IF EXISTS "reports_insert_user" ON public.reports;
DROP POLICY IF EXISTS reports_select_mod ON public.reports;
DROP POLICY IF EXISTS "reports_select_mod" ON public.reports;
DROP POLICY IF EXISTS reports_update_mod ON public.reports;
DROP POLICY IF EXISTS "reports_update_mod" ON public.reports;

CREATE POLICY reports_insert_user
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY reports_select_mod
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

CREATE POLICY reports_update_mod
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

-- ---------------------------------------------------------------------------
-- bug_reports: user can submit/read own; moderation/web-admin can read/update.
-- ---------------------------------------------------------------------------

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bug_reports_select_public ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_select_public" ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_select_auth ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_select_auth" ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_select_owner_or_mod ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_select_owner_or_mod" ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_insert_any_auth ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_insert_any_auth" ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_update_mod_only ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_update_mod_only" ON public.bug_reports;
DROP POLICY IF EXISTS bug_reports_delete_mod_only ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_delete_mod_only" ON public.bug_reports;

CREATE POLICY bug_reports_select_owner_or_mod
  ON public.bug_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.is_moderator());

CREATE POLICY bug_reports_insert_own
  ON public.bug_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY bug_reports_update_mod_only
  ON public.bug_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

CREATE POLICY bug_reports_delete_mod_only
  ON public.bug_reports
  FOR DELETE
  TO authenticated
  USING (public.is_moderator());

-- ---------------------------------------------------------------------------
-- notifications: recipient-only read/update; limited private invite insert.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_public ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_public" ON public.notifications;
DROP POLICY IF EXISTS notifications_select_auth ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_auth" ON public.notifications;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_mod ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_mod" ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_private_invite_creator ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_private_invite_creator" ON public.notifications;

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_insert_mod
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_moderator());

CREATE POLICY notifications_insert_private_invite_creator
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'system'
    AND data->>'kind' = 'private_invite'
    AND (data->>'event_id') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = (data->>'event_id')::uuid
        AND e.creator_id = auth.uid()
        AND e.visibility = 'prive'
    )
  );

-- ---------------------------------------------------------------------------
-- Safe aggregate RPCs for mobile UI.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_views_counts(event_ids uuid[])
RETURNS TABLE(event_id uuid, views_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT unnest(event_ids)::uuid AS event_id
  )
  SELECT
    r.event_id,
    COALESCE(COUNT(ev.event_id), 0)::bigint AS views_count
  FROM requested r
  LEFT JOIN public.event_views ev ON ev.event_id = r.event_id
  WHERE public.can_view_event(r.event_id)
  GROUP BY r.event_id;
$$;

REVOKE ALL ON FUNCTION public.get_event_views_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_views_counts(uuid[]) TO anon, authenticated, service_role;

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
  my_follows AS (
    SELECT f.following AS profile_id
    FROM public.follows f
    WHERE f.follower = auth.uid()
  )
  SELECT
    r.event_id,
    COALESCE(COUNT(DISTINCT mf.profile_id), 0)::bigint AS friends_count
  FROM requested r
  LEFT JOIN public.favorites fav
    ON fav.event_id = r.event_id
  LEFT JOIN my_follows mf
    ON mf.profile_id = fav.profile_id
  WHERE public.can_view_event(r.event_id)
  GROUP BY r.event_id;
$$;

REVOKE ALL ON FUNCTION public.get_event_friend_favorite_counts(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_event_friend_favorite_counts(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_friend_favorite_counts(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_event_public_stats(event_ids uuid[])
RETURNS TABLE(
  event_id uuid,
  likes_count bigint,
  interests_count bigint,
  checkins_count bigint,
  views_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT unnest(event_ids)::uuid AS event_id
  )
  SELECT
    r.event_id,
    COALESCE(l.likes_count, 0)::bigint AS likes_count,
    COALESCE(i.interests_count, 0)::bigint AS interests_count,
    COALESCE(c.checkins_count, 0)::bigint AS checkins_count,
    COALESCE(v.views_count, 0)::bigint AS views_count
  FROM requested r
  LEFT JOIN (
    SELECT event_id, COUNT(*)::bigint AS likes_count
    FROM public.event_likes
    GROUP BY event_id
  ) l ON l.event_id = r.event_id
  LEFT JOIN (
    SELECT event_id, COUNT(*)::bigint AS interests_count
    FROM public.event_interests
    GROUP BY event_id
  ) i ON i.event_id = r.event_id
  LEFT JOIN (
    SELECT event_id, COUNT(*)::bigint AS checkins_count
    FROM public.event_checkins
    GROUP BY event_id
  ) c ON c.event_id = r.event_id
  LEFT JOIN (
    SELECT event_id, COUNT(*)::bigint AS views_count
    FROM public.event_views
    GROUP BY event_id
  ) v ON v.event_id = r.event_id
  WHERE public.can_view_event(r.event_id);
$$;

REVOKE ALL ON FUNCTION public.get_event_public_stats(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_public_stats(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_event_checkin_preview(p_event_id uuid, p_limit integer DEFAULT 12)
RETURNS TABLE(total_count bigint, attendee_key text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH total AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM public.event_checkins c
    WHERE c.event_id = p_event_id
  ),
  preview AS (
    SELECT
      row_number() OVER (ORDER BY c.created_at DESC, c.id)::text AS attendee_key,
      p.avatar_url
    FROM public.event_checkins c
    LEFT JOIN public.profiles p ON p.id = c.user_id
    WHERE c.event_id = p_event_id
    ORDER BY c.created_at DESC, c.id
    LIMIT GREATEST(0, LEAST(COALESCE(p_limit, 12), 12))
  )
  SELECT total.total_count, preview.attendee_key, preview.avatar_url
  FROM total
  LEFT JOIN preview ON true
  WHERE public.can_view_event(p_event_id);
$$;

REVOKE ALL ON FUNCTION public.get_event_checkin_preview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_checkin_preview(uuid, integer) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
