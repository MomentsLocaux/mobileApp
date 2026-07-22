-- MVP-LUMO-009 — Early access events (M2)
-- Fenêtre avant public : Ambassadeur OU spend Lumo. Tracking signups + no-show.
-- Gated by is_gamification_enabled(). Apply DEV with human OK; no prod yet.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS early_access_until timestamptz;

CREATE INDEX IF NOT EXISTS events_early_access_until_idx
  ON public.events (early_access_until)
  WHERE early_access_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_early_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('ambassadeur', 'lumo_spend', 'mission', 'creator_grant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_early_access_user_idx
  ON public.event_early_access (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_early_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('ambassadeur', 'lumo_spend', 'mission', 'creator_grant', 'interest')),
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_early_signups_event_idx
  ON public.event_early_signups (event_id, signed_up_at DESC);

ALTER TABLE public.event_early_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_early_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_early_access_select_own ON public.event_early_access;
CREATE POLICY event_early_access_select_own
  ON public.event_early_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_early_signups_select_own ON public.event_early_signups;
CREATE POLICY event_early_signups_select_own
  ON public.event_early_signups
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.creator_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.event_early_access FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.event_early_signups FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.event_early_access TO authenticated;
GRANT SELECT ON TABLE public.event_early_signups TO authenticated;
GRANT ALL ON TABLE public.event_early_access TO service_role;
GRANT ALL ON TABLE public.event_early_signups TO service_role;

-- Shop sink (M2)
INSERT INTO public.shop_items (type, key, title, description, price, data)
VALUES (
  'consumable',
  'early_access_unlock',
  'Accès anticipé',
  'Débloque un événement en early access (M2)',
  40,
  jsonb_build_object(
    'adr', 'ADR_004',
    'mechanism', 'M2',
    'effect', 'early_access_unlock'
  )
)
ON CONFLICT (key) DO UPDATE
SET
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  data = EXCLUDED.data;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_in_early_window(p_early_access_until timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.is_gamification_enabled()
    AND p_early_access_until IS NOT NULL
    AND p_early_access_until > now();
$$;

CREATE OR REPLACE FUNCTION public.user_has_early_access(p_event_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := coalesce(p_user_id, auth.uid());
BEGIN
  IF v_user IS NULL OR p_event_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_early_access a
    WHERE a.event_id = p_event_id AND a.user_id = v_user
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_local_status s
    WHERE s.user_id = v_user AND s.is_ambassadeur = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_early_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_early_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_early_access(uuid, uuid) TO anon;

-- ---------------------------------------------------------------------------
-- Visibility: can_view_event + anon policy
-- ---------------------------------------------------------------------------
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
        e.creator_id = auth.uid()
        OR public.is_moderator()
        OR (
          e.visibility = 'public'
          AND e.status = 'published'
          AND (
            NOT public.event_in_early_window(e.early_access_until)
            OR public.user_has_early_access(e.id, auth.uid())
          )
        )
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

DROP POLICY IF EXISTS events_select_public ON public.events;
CREATE POLICY events_select_public
  ON public.events
  FOR SELECT
  TO anon
  USING (
    visibility = 'public'
    AND status = 'published'
    AND (
      NOT public.is_gamification_enabled()
      OR early_access_until IS NULL
      OR early_access_until <= now()
    )
  );

-- ---------------------------------------------------------------------------
-- Creator: open early-access window
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enable_event_early_access(
  p_event_id uuid,
  p_hours integer DEFAULT 48
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_hours integer := greatest(1, least(coalesce(p_hours, 48), 72));
  v_until timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_event.creator_id <> v_user AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'NOT_EVENT_OWNER';
  END IF;
  IF v_event.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'EVENT_NOT_PUBLISHED';
  END IF;
  IF v_event.visibility IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION 'EVENT_NOT_PUBLIC';
  END IF;

  v_until := now() + make_interval(hours => v_hours);
  IF v_event.starts_at IS NOT NULL AND v_until > v_event.starts_at THEN
    v_until := v_event.starts_at;
  END IF;

  IF v_until <= now() THEN
    RAISE EXCEPTION 'EARLY_WINDOW_INVALID';
  END IF;

  UPDATE public.events
  SET early_access_until = v_until,
      updated_at = now()
  WHERE id = p_event_id;

  RETURN json_build_object(
    'ok', true,
    'event_id', p_event_id,
    'early_access_until', v_until,
    'hours', v_hours
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enable_event_early_access(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enable_event_early_access(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Spend Lumo to unlock (works even if SELECT blocked — deep link)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_early_access(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_item_id uuid;
  v_price integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_event.status IS DISTINCT FROM 'published' OR v_event.visibility IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION 'EVENT_NOT_ELIGIBLE';
  END IF;
  IF NOT public.event_in_early_window(v_event.early_access_until) THEN
    RAISE EXCEPTION 'EARLY_WINDOW_CLOSED';
  END IF;

  IF public.user_has_early_access(p_event_id, v_user) THEN
    RETURN json_build_object('ok', true, 'already', true, 'event_id', p_event_id);
  END IF;

  SELECT id, price INTO v_item_id, v_price
  FROM public.shop_items
  WHERE key = 'early_access_unlock';

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  PERFORM public.spend_lumo(
    v_price,
    'early_access',
    v_item_id,
    jsonb_build_object('event_id', p_event_id)
  );

  INSERT INTO public.event_early_access (event_id, user_id, source)
  VALUES (p_event_id, v_user, 'lumo_spend')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  INSERT INTO public.event_early_signups (event_id, user_id, source)
  VALUES (p_event_id, v_user, 'lumo_spend')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'ok', true,
    'event_id', p_event_id,
    'price', v_price,
    'early_access_until', v_event.early_access_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_early_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_early_access(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ambassadeur claim + interest during window → signup tracking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_early_access(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_source text := 'ambassadeur';
  v_is_amb boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT public.is_gamification_enabled() THEN
    RAISE EXCEPTION 'GAMIFICATION_DISABLED';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF NOT public.event_in_early_window(v_event.early_access_until) THEN
    RAISE EXCEPTION 'EARLY_WINDOW_CLOSED';
  END IF;

  SELECT coalesce(is_ambassadeur, false) INTO v_is_amb
  FROM public.user_local_status
  WHERE user_id = v_user;

  IF NOT coalesce(v_is_amb, false)
     AND NOT EXISTS (
       SELECT 1 FROM public.event_early_access
       WHERE event_id = p_event_id AND user_id = v_user
     ) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE';
  END IF;

  IF coalesce(v_is_amb, false) THEN
    v_source := 'ambassadeur';
    INSERT INTO public.event_early_access (event_id, user_id, source)
    VALUES (p_event_id, v_user, 'ambassadeur')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  ELSE
    SELECT source INTO v_source
    FROM public.event_early_access
    WHERE event_id = p_event_id AND user_id = v_user;
  END IF;

  INSERT INTO public.event_early_signups (event_id, user_id, source)
  VALUES (p_event_id, v_user, coalesce(v_source, 'interest'))
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'ok', true,
    'event_id', p_event_id,
    'source', coalesce(v_source, 'interest'),
    'early_access_until', v_event.early_access_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_early_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_early_access(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Creator stats (no-show = early signup, event ended, no check-in)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_event_early_stats(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_signups integer := 0;
  v_checked_in integer := 0;
  v_no_show integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;
  IF v_event.creator_id <> v_user AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'NOT_EVENT_OWNER';
  END IF;

  SELECT count(*)::integer INTO v_signups
  FROM public.event_early_signups
  WHERE event_id = p_event_id;

  SELECT count(*)::integer INTO v_checked_in
  FROM public.event_early_signups s
  WHERE s.event_id = p_event_id
    AND EXISTS (
      SELECT 1 FROM public.event_checkins c
      WHERE c.event_id = s.event_id AND c.user_id = s.user_id
    );

  IF v_event.ends_at IS NOT NULL AND v_event.ends_at < now() THEN
    v_no_show := greatest(v_signups - v_checked_in, 0);
  ELSE
    v_no_show := 0;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'event_id', p_event_id,
    'early_access_until', v_event.early_access_until,
    'window_active', public.event_in_early_window(v_event.early_access_until),
    'early_signups', v_signups,
    'checked_in', v_checked_in,
    'no_show', v_no_show
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_early_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_early_stats(uuid) TO authenticated;

-- Teaser for locked deep-links (no sensitive fields)
CREATE OR REPLACE FUNCTION public.get_early_access_teaser(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event.id IS NULL
     OR v_event.status IS DISTINCT FROM 'published'
     OR v_event.visibility IS DISTINCT FROM 'public' THEN
    RETURN json_build_object('ok', false, 'reason', 'NOT_FOUND');
  END IF;

  IF NOT public.event_in_early_window(v_event.early_access_until) THEN
    RETURN json_build_object('ok', false, 'reason', 'NOT_IN_EARLY_WINDOW');
  END IF;

  IF public.can_view_event(p_event_id) THEN
    RETURN json_build_object(
      'ok', true,
      'locked', false,
      'event_id', p_event_id,
      'title', v_event.title,
      'early_access_until', v_event.early_access_until,
      'has_access', true
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'locked', true,
    'event_id', p_event_id,
    'title', v_event.title,
    'city', v_event.city,
    'starts_at', v_event.starts_at,
    'cover_url', v_event.cover_url,
    'early_access_until', v_event.early_access_until,
    'has_access', public.user_has_early_access(p_event_id, v_user),
    'unlock_price', (
      SELECT price FROM public.shop_items WHERE key = 'early_access_unlock' LIMIT 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_early_access_teaser(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_early_access_teaser(uuid) TO anon, authenticated;
