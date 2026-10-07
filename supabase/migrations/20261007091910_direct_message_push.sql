-- Notify the other participant when a direct message is sent.
-- Title is the sender name, body is a short preview. The phone decides
-- whether that preview is hidden on the lock screen.
-- Opening the conversation marks those alerts as read.
-- Do NOT apply without human validation.

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

  -- A notification failure must not discard the message.
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

  IF NOT EXISTS (
    SELECT 1 FROM public.direct_conversation_participants me
    WHERE me.conversation_id = p_conversation_id AND me.user_id = v_me
  ) THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.direct_conversation_participants
    SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = v_me;

  UPDATE public.notifications n
    SET read = true
  WHERE n.user_id = v_me
    AND n.read = false
    AND n.type = 'direct_message'
    AND n.data->>'conversationId' = p_conversation_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_direct_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_direct_conversation_read(uuid) TO authenticated;
