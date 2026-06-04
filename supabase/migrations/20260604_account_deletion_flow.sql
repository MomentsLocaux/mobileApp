BEGIN;

-- MVP-P0-006: functional account deletion/anonymisation flow.
-- The mobile client calls the delete-account Edge Function. The function verifies
-- the JWT, removes Storage objects with the service role, then calls this RPC to
-- purge private app data and anonymize public content.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  auth_deleted_at timestamptz,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processed', 'auth_deleted', 'failed')),
  error text
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id
  ON public.account_deletion_requests(user_id);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_deletion_requests_select_own ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_select_own
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_event_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean := auth.role() = 'service_role';
  v_is_moderator boolean := public.is_moderator();
  v_is_account_deletion boolean := current_setting('app.account_deletion', true) = 'on';
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_is_service_role OR v_is_moderator OR v_is_account_deletion THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_actor_id IS NULL OR NEW.creator_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'event creator must match authenticated user'
        USING ERRCODE = '42501';
    END IF;

    IF COALESCE(NEW.status::text, 'pending') NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'creators can only create draft or pending events'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_actor_id IS NULL OR OLD.creator_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'only the event creator can update this event'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
      RAISE EXCEPTION 'event creator cannot be changed'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status::text IN ('pending', 'published', 'archived') THEN
      RAISE EXCEPTION 'event status % is read-only for creators', OLD.status
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status::text = 'draft' AND NEW.status::text NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'draft events can only remain draft or move to pending'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status::text = 'refused' AND NEW.status::text NOT IN ('refused', 'pending') THEN
      RAISE EXCEPTION 'refused events can only remain refused or move to pending'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

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

  UPDATE public.profiles
  SET email = NULL,
      display_name = 'Utilisateur supprimé',
      avatar_url = NULL,
      cover_url = NULL,
      bio = NULL,
      city = NULL,
      region = NULL,
      facebook_url = NULL,
      instagram_url = NULL,
      tiktok_url = NULL,
      onboarding_completed = false,
      status = 'suspended',
      updated_at = now()
  WHERE id = v_user_id;

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
