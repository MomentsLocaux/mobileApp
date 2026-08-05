-- Read-only diagnostics for MVP-P1-COMMUNITY-PHOTO-CHECKIN-GATE.
-- Run only after human application of 20260805101734_community_photo_checkin_gate.sql.

SELECT key, value, updated_at
FROM public.app_config
WHERE key = 'checkin_enabled';

SELECT
  n.nspname AS function_schema,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname = 'is_checkin_enabled';

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'event_media_submissions'
  AND policyname = 'event_media_submissions_insert_auth';

SELECT
  has_schema_privilege('authenticated', 'private', 'USAGE') AS authenticated_has_private_usage,
  has_function_privilege(
    'authenticated',
    'private.is_checkin_enabled()',
    'EXECUTE'
  ) AS authenticated_can_evaluate_flag;

-- Manual role matrix to execute from authenticated test clients:
-- flag false: active member + published event + no check-in -> INSERT allowed
-- flag true:  active member + published event + no check-in -> INSERT denied
-- flag true:  checked-in member / owner / admin -> INSERT allowed
-- all flags:  wrong author_id / inactive member / unpublished event -> INSERT denied
