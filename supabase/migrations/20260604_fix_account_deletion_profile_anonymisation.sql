BEGIN;

-- MVP-P0-006 follow-up: make profile anonymisation tolerant of schema drift.
-- Some environments keep email only in auth.users, not public.profiles.

CREATE OR REPLACE FUNCTION public.process_account_deletion(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_role text := auth.role();
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_request_id uuid;
  v_event_count integer := 0;
  v_profile_updates text[] := ARRAY[]::text[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_actor_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'cannot process deletion for another user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.account_deletion_requests(user_id, status)
  VALUES (v_user_id, 'requested')
  RETURNING id INTO v_request_id;

  PERFORM set_config('app.account_deletion', 'on', true);

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.favorites') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.favorites WHERE profile_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.follows') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.follows WHERE follower = $1 OR following = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_likes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_likes WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_views') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_views WHERE profile_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_checkins') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_checkins WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_interests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_interests WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.comment_likes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.comment_likes WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_media_submission_likes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_media_submission_likes WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.user_badges') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_badges WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.user_missions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_missions WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.lumo_transactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.lumo_transactions WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.transactions WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.wallets') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.wallets WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.bug_reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.bug_reports WHERE reporter_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.reports WHERE reporter_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_media_submissions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_media_submissions WHERE author_id = $1' USING v_user_id;
  END IF;

  IF to_regclass('public.event_comments') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.event_comments
      SET message = 'Commentaire supprimé',
          rating = NULL,
          updated_at = now()
      WHERE author_id = $1
    $sql$ USING v_user_id;
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.events
      SET contact_email = NULL,
          contact_phone = NULL,
          external_url = NULL,
          updated_at = now()
      WHERE creator_id = $1
        AND status = 'published'
        AND visibility = 'public'
    $sql$ USING v_user_id;

    EXECUTE $sql$
      UPDATE public.events
      SET title = 'Événement supprimé',
          description = '',
          visibility = 'prive',
          status = 'archived',
          contact_email = NULL,
          contact_phone = NULL,
          external_url = NULL,
          cover_url = NULL,
          updated_at = now()
      WHERE creator_id = $1
        AND NOT (status = 'published' AND visibility = 'public')
    $sql$ USING v_user_id;

    GET DIAGNOSTICS v_event_count = ROW_COUNT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    v_profile_updates := array_append(v_profile_updates, 'email = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name') THEN
    v_profile_updates := array_append(v_profile_updates, 'display_name = ''Utilisateur supprimé''');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    v_profile_updates := array_append(v_profile_updates, 'avatar_url = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cover_url') THEN
    v_profile_updates := array_append(v_profile_updates, 'cover_url = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio') THEN
    v_profile_updates := array_append(v_profile_updates, 'bio = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city') THEN
    v_profile_updates := array_append(v_profile_updates, 'city = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'region') THEN
    v_profile_updates := array_append(v_profile_updates, 'region = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'facebook_url') THEN
    v_profile_updates := array_append(v_profile_updates, 'facebook_url = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'instagram_url') THEN
    v_profile_updates := array_append(v_profile_updates, 'instagram_url = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tiktok_url') THEN
    v_profile_updates := array_append(v_profile_updates, 'tiktok_url = NULL');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
    v_profile_updates := array_append(v_profile_updates, 'onboarding_completed = false');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status') THEN
    v_profile_updates := array_append(v_profile_updates, 'status = ''suspended''');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    v_profile_updates := array_append(v_profile_updates, 'updated_at = now()');
  END IF;

  IF array_length(v_profile_updates, 1) IS NOT NULL THEN
    EXECUTE 'UPDATE public.profiles SET ' || array_to_string(v_profile_updates, ', ') || ' WHERE id = $1'
      USING v_user_id;
  END IF;

  UPDATE public.account_deletion_requests
  SET status = 'processed',
      processed_at = now()
  WHERE id = v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'archived_private_events', v_event_count
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_request_id IS NOT NULL THEN
      UPDATE public.account_deletion_requests
      SET status = 'failed',
          error = SQLERRM
      WHERE id = v_request_id;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_account_deletion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_account_deletion(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
