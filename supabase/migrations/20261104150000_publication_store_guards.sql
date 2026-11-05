-- Publication guards. Human validation required before apply.
-- Drops the wide storage policies, limits image size and type,
-- closes update_leaderboard to clients, enforces the cover quota,
-- and adds block plus message reports.

-- ---------------------------------------------------------------------------
-- Storage: the wide policies OR with the stricter owner-path policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Avatar insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete" ON storage.objects;
DROP POLICY IF EXISTS "Event media insert" ON storage.objects;
DROP POLICY IF EXISTS "Event media update" ON storage.objects;
DROP POLICY IF EXISTS "Event media delete" ON storage.objects;

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'avatar';

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'event-media';

-- ---------------------------------------------------------------------------
-- Leaderboard writes stay on the server.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.update_leaderboard(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_leaderboard(uuid, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Cover quota: two generations per draft. Missing quota must not mean unlimited.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_cover_generate_usage (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  draft_id uuid NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, draft_id)
);

ALTER TABLE public.event_cover_generate_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_cover_generate_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_event_cover_generate_quota(
  p_user_id uuid,
  p_draft_id uuid,
  p_limit integer DEFAULT 2
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_draft_id IS NULL OR coalesce(p_limit, 0) < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.event_cover_generate_usage (user_id, draft_id, request_count, updated_at)
  VALUES (p_user_id, p_draft_id, 1, now())
  ON CONFLICT (user_id, draft_id)
  DO UPDATE
    SET request_count = public.event_cover_generate_usage.request_count + 1,
        updated_at = now()
    WHERE public.event_cover_generate_usage.request_count < p_limit
  RETURNING request_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_event_cover_generate_quota(
  p_user_id uuid,
  p_draft_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_cover_generate_usage
  SET request_count = greatest(request_count - 1, 0),
      updated_at = now()
  WHERE user_id = p_user_id
    AND draft_id = p_draft_id
    AND request_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_event_cover_generate_quota(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_event_cover_generate_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_event_cover_generate_quota(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_event_cover_generate_quota(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Block and message reports.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own
  ON public.user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND public.is_profile_active(auth.uid()));

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own
  ON public.user_blocks
  FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

REVOKE ALL ON TABLE public.user_blocks FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_blocks TO authenticated;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type = ANY (ARRAY['event', 'comment', 'user', 'challenge', 'media', 'direct_message']));

CREATE OR REPLACE FUNCTION public.users_blocked_either_way(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = p_a AND b.blocked_id = p_b)
       OR (b.blocker_id = p_b AND b.blocked_id = p_a)
  );
$$;

REVOKE ALL ON FUNCTION public.users_blocked_either_way(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.users_blocked_either_way(uuid, uuid) TO service_role;

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

  IF public.users_blocked_either_way(v_me, p_target) THEN
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
  IF public.users_blocked_either_way(v_me, p_target) THEN
    RAISE EXCEPTION 'Cet échange est bloqué' USING ERRCODE = '42501';
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
  v_sender_name text;
  v_preview text;
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

  IF public.users_blocked_either_way(v_me, v_other) THEN
    RAISE EXCEPTION 'Cet échange est bloqué' USING ERRCODE = '42501';
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

  SELECT COALESCE(NULLIF(btrim(pr.display_name), ''), 'Membre')
    INTO v_sender_name
  FROM public.profiles pr
  WHERE pr.id = v_me;

  v_preview := regexp_replace(v_body, '[[:space:]]+', ' ', 'g');
  IF char_length(v_preview) > 140 THEN
    v_preview := left(v_preview, 139) || '…';
  END IF;

  BEGIN
    PERFORM public.deliver_user_notification(
      v_other,
      'direct_message',
      COALESCE(v_sender_name, 'Membre'),
      v_preview,
      jsonb_build_object(
        'conversationId', p_conversation_id,
        'senderId', v_me,
        'messageId', v_row.id
      ),
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'direct message notification failed: %', SQLERRM;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.can_message_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_message_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;
