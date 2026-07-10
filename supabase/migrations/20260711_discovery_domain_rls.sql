-- DISC-P0-002: Discovery domain RLS, RPCs, and account-deletion purge extension.
--
-- Scope:
--   - Enable RLS on all discovery tables (owner read; limited client write).
--   - SECURITY DEFINER RPCs for consent, entitlement, recommendations funnel.
--   - Extend process_account_deletion to purge discovery_* (to_regclass guarded).
--
-- Depends on: 20260710_discovery_domain_schema.sql
-- Do NOT apply to production without human validation.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_location_batches ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2) Policies — user_subscriptions (read own only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_subscriptions_select_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_select_own
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Policies — discovery_consents (owner manage)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS discovery_consents_select_own ON public.discovery_consents;
CREATE POLICY discovery_consents_select_own
  ON public.discovery_consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS discovery_consents_insert_own ON public.discovery_consents;
CREATE POLICY discovery_consents_insert_own
  ON public.discovery_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS discovery_consents_update_own ON public.discovery_consents;
CREATE POLICY discovery_consents_update_own
  ON public.discovery_consents
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Policies — read-only derived data for clients
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS discovery_places_select_own ON public.discovery_places;
CREATE POLICY discovery_places_select_own
  ON public.discovery_places
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS discovery_visits_select_own ON public.discovery_visits;
CREATE POLICY discovery_visits_select_own
  ON public.discovery_visits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mobility_profiles_select_own ON public.mobility_profiles;
CREATE POLICY mobility_profiles_select_own
  ON public.mobility_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS discovery_profiles_select_own ON public.discovery_profiles;
CREATE POLICY discovery_profiles_select_own
  ON public.discovery_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS discovery_insights_select_own ON public.discovery_insights;
CREATE POLICY discovery_insights_select_own
  ON public.discovery_insights
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS discovery_daily_summaries_select_own ON public.discovery_daily_summaries;
CREATE POLICY discovery_daily_summaries_select_own
  ON public.discovery_daily_summaries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS event_recommendations_select_own ON public.event_recommendations;
CREATE POLICY event_recommendations_select_own
  ON public.event_recommendations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS recommendation_events_select_own ON public.recommendation_events;
CREATE POLICY recommendation_events_select_own
  ON public.recommendation_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- discovery_location_batches: no client access (service_role only via ingest)

-- ---------------------------------------------------------------------------
-- 5) RPC — get_user_entitlement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_entitlement(p_entitlement text DEFAULT 'moments_locaux_plus')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.user_subscriptions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_row
  FROM public.user_subscriptions us
  WHERE us.user_id = v_user_id
    AND us.entitlement = p_entitlement
  ORDER BY us.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_active', false,
      'status', 'expired',
      'entitlement', p_entitlement,
      'expires_at', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'is_active', v_row.status IN ('active', 'grace_period', 'trialing')
      AND (v_row.expires_at IS NULL OR v_row.expires_at > now()),
    'status', v_row.status,
    'entitlement', v_row.entitlement,
    'expires_at', v_row.expires_at,
    'auto_renew', v_row.auto_renew
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_entitlement(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_entitlement(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) RPC — upsert_discovery_consent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_discovery_consent(
  p_enabled boolean,
  p_location_enabled boolean DEFAULT false,
  p_motion_enabled boolean DEFAULT false,
  p_personalization_enabled boolean DEFAULT false,
  p_consent_version text DEFAULT '1.0'
)
RETURNS public.discovery_consents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.discovery_consents%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.discovery_consents (
    user_id,
    enabled,
    location_enabled,
    motion_enabled,
    personalization_enabled,
    consent_version,
    granted_at,
    revoked_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_enabled,
    CASE WHEN p_enabled THEN p_location_enabled ELSE false END,
    CASE WHEN p_enabled THEN p_motion_enabled ELSE false END,
    CASE WHEN p_enabled THEN p_personalization_enabled ELSE false END,
    p_consent_version,
    CASE WHEN p_enabled THEN now() ELSE NULL END,
    CASE WHEN p_enabled THEN NULL ELSE now() END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    enabled = EXCLUDED.enabled,
    location_enabled = EXCLUDED.location_enabled,
    motion_enabled = EXCLUDED.motion_enabled,
    personalization_enabled = EXCLUDED.personalization_enabled,
    consent_version = EXCLUDED.consent_version,
    granted_at = CASE
      WHEN EXCLUDED.enabled AND discovery_consents.enabled IS DISTINCT FROM true THEN now()
      WHEN EXCLUDED.enabled THEN discovery_consents.granted_at
      ELSE discovery_consents.granted_at
    END,
    revoked_at = CASE
      WHEN NOT EXCLUDED.enabled THEN now()
      ELSE NULL
    END,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_discovery_consent(boolean, boolean, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_discovery_consent(boolean, boolean, boolean, boolean, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) RPC — track_recommendation_event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_recommendation_event(
  p_recommendation_id uuid,
  p_event_type public.recommendation_event_type,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.recommendation_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.recommendation_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_recommendations er
    WHERE er.id = p_recommendation_id
      AND er.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'recommendation not found' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.recommendation_events (
    recommendation_id,
    user_id,
    event_type,
    metadata
  )
  VALUES (
    p_recommendation_id,
    v_user_id,
    p_event_type,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  UPDATE public.event_recommendations er
  SET
    displayed_at = CASE WHEN p_event_type = 'displayed' AND er.displayed_at IS NULL THEN now() ELSE er.displayed_at END,
    opened_at = CASE WHEN p_event_type = 'opened' AND er.opened_at IS NULL THEN now() ELSE er.opened_at END,
    dismissed_at = CASE WHEN p_event_type = 'dismissed' AND er.dismissed_at IS NULL THEN now() ELSE er.dismissed_at END,
    route_requested_at = CASE WHEN p_event_type = 'route_requested' AND er.route_requested_at IS NULL THEN now() ELSE er.route_requested_at END,
    probable_visit_at = CASE WHEN p_event_type = 'probable_visit' AND er.probable_visit_at IS NULL THEN now() ELSE er.probable_visit_at END,
    confirmed_checkin_at = CASE WHEN p_event_type = 'confirmed_checkin' AND er.confirmed_checkin_at IS NULL THEN now() ELSE er.confirmed_checkin_at END
  WHERE er.id = p_recommendation_id
    AND er.user_id = v_user_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.track_recommendation_event(uuid, public.recommendation_event_type, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_recommendation_event(uuid, public.recommendation_event_type, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8) RPC — get_active_recommendations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_recommendations(
  p_type public.recommendation_type DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS SETOF public.event_recommendations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT er.*
  FROM public.event_recommendations er
  WHERE er.user_id = auth.uid()
    AND er.valid_until > now()
    AND (p_type IS NULL OR er.recommendation_type = p_type)
  ORDER BY er.score DESC, er.generated_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.get_active_recommendations(public.recommendation_type, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_recommendations(public.recommendation_type, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9) RPC — mark_discovery_insight_seen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_discovery_insight_seen(p_insight_id uuid)
RETURNS public.discovery_insights
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.discovery_insights%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.discovery_insights di
  SET seen_at = COALESCE(di.seen_at, now())
  WHERE di.id = p_insight_id
    AND di.user_id = v_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insight not found' USING ERRCODE = '42501';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_discovery_insight_seen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_discovery_insight_seen(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10) RPC — purge_discovery_data (GDPR user-initiated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_discovery_data(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_role text := auth.role();
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'service_role' AND v_actor_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'cannot purge discovery data for another user' USING ERRCODE = '42501';
  END IF;

  IF to_regclass('public.recommendation_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.recommendation_events WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_visits') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_visits WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_recommendations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_recommendations WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_insights') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_insights WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_daily_summaries') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_daily_summaries WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_location_batches') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_location_batches WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_places') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_places WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.mobility_profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.mobility_profiles WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_profiles WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_consents') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_consents WHERE user_id = $1' USING v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_discovery_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_discovery_data(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11) Extend process_account_deletion — discovery purge (to_regclass guarded)
-- ---------------------------------------------------------------------------
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

  -- Discovery domain purge (DISC-P0-002)
  IF to_regclass('public.recommendation_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.recommendation_events WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_visits') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_visits WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.event_recommendations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.event_recommendations WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_insights') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_insights WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_daily_summaries') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_daily_summaries WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_location_batches') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_location_batches WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_places') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_places WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.mobility_profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.mobility_profiles WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_profiles WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.discovery_consents') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.discovery_consents WHERE user_id = $1' USING v_user_id;
  END IF;
  IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_subscriptions WHERE user_id = $1' USING v_user_id;
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
