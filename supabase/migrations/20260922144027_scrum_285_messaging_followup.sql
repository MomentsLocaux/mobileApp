-- SCRUM-285 follow-up: table writes stay on SECURITY DEFINER RPCs;
-- friendship helper is not callable from PostgREST.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.direct_conversations FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.direct_conversation_participants FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.direct_messages FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.direct_conversations TO authenticated;
GRANT SELECT ON TABLE public.direct_conversation_participants TO authenticated;
GRANT SELECT ON TABLE public.direct_messages TO authenticated;

REVOKE ALL ON FUNCTION public.are_mutual_followers(uuid, uuid) FROM PUBLIC, anon, authenticated;
