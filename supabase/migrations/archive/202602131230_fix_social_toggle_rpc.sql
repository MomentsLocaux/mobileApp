BEGIN;

CREATE OR REPLACE FUNCTION public.toggle_like(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  DELETE FROM public.event_likes
  WHERE user_id = v_user_id
    AND event_likes.event_id = toggle_like.event_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN FALSE;
  END IF;

  BEGIN
    INSERT INTO public.event_likes (user_id, event_id)
    VALUES (v_user_id, toggle_like.event_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_favorite(event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  DELETE FROM public.favorites
  WHERE profile_id = v_user_id
    AND favorites.event_id = toggle_favorite.event_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RETURN FALSE;
  END IF;

  BEGIN
    INSERT INTO public.favorites (profile_id, event_id)
    VALUES (v_user_id, toggle_favorite.event_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_like(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_like(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_like(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_favorite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_favorite(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(uuid) TO authenticated;

COMMIT;
