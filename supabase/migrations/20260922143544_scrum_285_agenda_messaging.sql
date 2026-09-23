-- SCRUM-285 (+ social DMs / profile visibility)
-- Human validation required before apply on DEV/UAT. Do not auto-apply.
--
-- * profiles.profile_visibility: public (default) | private
-- * Direct conversations between two authenticated users
-- * Private profiles can be messaged only by mutual followers ("amis")

-- ---------------------------------------------------------------------------
-- Profile visibility
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_profile_visibility_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_profile_visibility_check
      CHECK (profile_visibility IN ('public', 'private'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.profile_visibility IS
  'public: authenticated members may send a DM. private: mutual follow (friend) required.';

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.direct_conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_body_len CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS direct_conversation_participants_user_idx
  ON public.direct_conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_created_idx
  ON public.direct_messages (conversation_id, created_at DESC);

ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.direct_conversations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.direct_conversation_participants FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.direct_messages FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.direct_conversations TO authenticated;
GRANT SELECT ON TABLE public.direct_conversation_participants TO authenticated;
GRANT SELECT ON TABLE public.direct_messages TO authenticated;

-- Bypass RLS when checking membership so policies do not recurse on
-- direct_conversation_participants (PostgREST 42P17 / Realtime apply_rls).
CREATE OR REPLACE FUNCTION public.is_direct_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.direct_conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_direct_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_direct_conversation_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS direct_conversations_select_participant ON public.direct_conversations;
CREATE POLICY direct_conversations_select_participant
  ON public.direct_conversations
  FOR SELECT
  TO authenticated
  USING (public.is_direct_conversation_participant(id));

DROP POLICY IF EXISTS direct_participants_select_own ON public.direct_conversation_participants;
CREATE POLICY direct_participants_select_own
  ON public.direct_conversation_participants
  FOR SELECT
  TO authenticated
  USING (public.is_direct_conversation_participant(conversation_id));

DROP POLICY IF EXISTS direct_messages_select_participant ON public.direct_messages;
CREATE POLICY direct_messages_select_participant
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (public.is_direct_conversation_participant(conversation_id));

-- Writes go through SECURITY DEFINER RPCs only (no INSERT/UPDATE/DELETE grants).

-- ---------------------------------------------------------------------------
-- Helpers / RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_mutual_followers(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_a IS DISTINCT FROM p_b
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower = p_a AND following = p_b
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower = p_b AND following = p_a
    );
$$;

CREATE OR REPLACE FUNCTION public.can_message_profile(p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_visibility text;
BEGIN
  IF v_me IS NULL OR p_target IS NULL OR v_me = p_target THEN
    RETURN false;
  END IF;

  SELECT COALESCE(profile_visibility, 'public')
    INTO v_visibility
  FROM public.profiles
  WHERE id = p_target
    AND COALESCE(status, 'active') = 'active';

  IF v_visibility IS NULL THEN
    RETURN false;
  END IF;

  IF v_visibility = 'public' THEN
    RETURN true;
  END IF;

  RETURN public.are_mutual_followers(v_me, p_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_target uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conversation_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_target IS NULL OR p_target = v_me THEN
    RAISE EXCEPTION 'Invalid recipient' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_message_profile(p_target) THEN
    RAISE EXCEPTION 'Messaging is limited to public profiles or mutual friends'
      USING ERRCODE = '42501';
  END IF;

  SELECT c.id
    INTO v_conversation_id
  FROM public.direct_conversations c
  JOIN public.direct_conversation_participants a
    ON a.conversation_id = c.id AND a.user_id = v_me
  JOIN public.direct_conversation_participants b
    ON b.conversation_id = c.id AND b.user_id = p_target
  WHERE (
    SELECT count(*) FROM public.direct_conversation_participants p
    WHERE p.conversation_id = c.id
  ) = 2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.direct_conversations DEFAULT VALUES
    RETURNING id INTO v_conversation_id;

  INSERT INTO public.direct_conversation_participants (conversation_id, user_id)
  VALUES
    (v_conversation_id, v_me),
    (v_conversation_id, p_target);

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_direct_message(p_conversation_id uuid, p_body text)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_other uuid;
  v_body text := btrim(p_body);
  v_row public.direct_messages;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_body IS NULL OR char_length(v_body) < 1 OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Invalid message' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id
    INTO v_other
  FROM public.direct_conversation_participants p
  WHERE p.conversation_id = p_conversation_id
    AND p.user_id <> v_me
  LIMIT 1;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.direct_conversation_participants me
    WHERE me.conversation_id = p_conversation_id AND me.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_message_profile(v_other) THEN
    RAISE EXCEPTION 'Messaging is limited to public profiles or mutual friends'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_me, v_body)
  RETURNING * INTO v_row;

  UPDATE public.direct_conversations
    SET updated_at = now()
  WHERE id = p_conversation_id;

  UPDATE public.direct_conversation_participants
    SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = v_me;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_direct_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.direct_conversation_participants
    SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = v_me;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_direct_conversations()
RETURNS TABLE (
  conversation_id uuid,
  other_user_id uuid,
  display_name text,
  avatar_url text,
  last_body text,
  last_at timestamptz,
  unread_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversation_id,
    other.user_id AS other_user_id,
    COALESCE(pr.display_name, 'Membre') AS display_name,
    pr.avatar_url,
    last_msg.body AS last_body,
    COALESCE(last_msg.created_at, c.updated_at) AS last_at,
    COALESCE(unread.unread_count, 0)::integer AS unread_count
  FROM public.direct_conversations c
  JOIN public.direct_conversation_participants me
    ON me.conversation_id = c.id AND me.user_id = auth.uid()
  JOIN public.direct_conversation_participants other
    ON other.conversation_id = c.id AND other.user_id <> auth.uid()
  LEFT JOIN public.profiles pr
    ON pr.id = other.user_id
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at
    FROM public.direct_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) last_msg ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS unread_count
    FROM public.direct_messages m
    WHERE m.conversation_id = c.id
      AND m.sender_id <> auth.uid()
      AND (me.last_read_at IS NULL OR m.created_at > me.last_read_at)
  ) unread ON true
  ORDER BY COALESCE(last_msg.created_at, c.updated_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.direct_messages_unread_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(unread.unread_count), 0)::integer
  FROM public.direct_conversation_participants me
  JOIN LATERAL (
    SELECT count(*)::integer AS unread_count
    FROM public.direct_messages m
    WHERE m.conversation_id = me.conversation_id
      AND m.sender_id <> me.user_id
      AND (me.last_read_at IS NULL OR m.created_at > me.last_read_at)
  ) unread ON true
  WHERE me.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.are_mutual_followers(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_message_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_direct_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_direct_conversations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.direct_messages_unread_count() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.are_mutual_followers(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_message_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_direct_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_direct_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.direct_messages_unread_count() TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
