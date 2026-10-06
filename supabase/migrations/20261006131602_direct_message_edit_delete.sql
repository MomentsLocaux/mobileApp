-- Author can edit or delete their own direct messages.
-- Writes stay on SECURITY DEFINER RPCs; table UPDATE/DELETE remain revoked.

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- DELETE realtime payloads only include the primary key unless the replica
-- identity is FULL, so the conversation filter would miss removals.
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.edit_direct_message(p_message_id uuid, p_body text)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_body text := btrim(p_body);
  v_row public.direct_messages;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_body IS NULL OR char_length(v_body) < 1 OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Invalid message' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_row
  FROM public.direct_messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF v_row.id IS NULL OR v_row.sender_id <> v_me THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_direct_conversation_participant(v_row.conversation_id) THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.direct_messages
    SET body = v_body,
        edited_at = now()
  WHERE id = p_message_id
  RETURNING * INTO v_row;

  UPDATE public.direct_conversations
    SET updated_at = now()
  WHERE id = v_row.conversation_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_direct_message(p_message_id uuid)
RETURNS void
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

  SELECT conversation_id
    INTO v_conversation_id
  FROM public.direct_messages
  WHERE id = p_message_id
    AND sender_id = v_me
  FOR UPDATE;

  IF v_conversation_id IS NULL
     OR NOT public.is_direct_conversation_participant(v_conversation_id) THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.direct_messages
  WHERE id = p_message_id
    AND sender_id = v_me;

  UPDATE public.direct_conversations
    SET updated_at = now()
  WHERE id = v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_direct_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_direct_message(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.edit_direct_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_direct_message(uuid) TO authenticated;
