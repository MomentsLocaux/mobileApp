-- MVP-P1-COMMUNITY-PHOTO-CHECKIN-GATE
-- Park the community-photo check-in requirement while FEATURE_CHECKIN is off.
-- This migration is intentionally not applied automatically by the mobile workflow.

BEGIN;

INSERT INTO public.app_config (key, value)
VALUES ('checkin_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_checkin_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND lower(coalesce(
      (
        SELECT value
        FROM public.app_config
        WHERE key = 'checkin_enabled'
        LIMIT 1
      ),
      'false'
    )) IN ('true', '1', 'yes', 'on');
$$;

REVOKE ALL ON FUNCTION private.is_checkin_enabled() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_checkin_enabled() TO authenticated;

ALTER TABLE public.event_media_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_media_submissions_insert_auth
  ON public.event_media_submissions;

CREATE POLICY event_media_submissions_insert_auth
  ON public.event_media_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND public.is_profile_active((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_media_submissions.event_id
        AND e.status = 'published'
    )
    AND (
      NOT (SELECT private.is_checkin_enabled())
      OR EXISTS (
        SELECT 1
        FROM public.events e_owner
        WHERE e_owner.id = event_media_submissions.event_id
          AND e_owner.creator_id = (SELECT auth.uid())
      )
      OR COALESCE(
        (SELECT auth.jwt())->'app_metadata'->>'role',
        (SELECT auth.jwt())->>'role'
      ) IN ('moderateur', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.event_checkins c
        WHERE c.event_id = event_media_submissions.event_id
          AND c.user_id = (SELECT auth.uid())
      )
    )
  );

COMMENT ON FUNCTION private.is_checkin_enabled() IS
  'Server-side mirror of EXPO_PUBLIC_FEATURE_CHECKIN for RLS-protected feature behavior.';

COMMIT;
