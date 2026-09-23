-- Fix recursive RLS on direct_conversation_participants (42P17).
-- Reading messages / Realtime apply_rls queried the same table from its policy.

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
