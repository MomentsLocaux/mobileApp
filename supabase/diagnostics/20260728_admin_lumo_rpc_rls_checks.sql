-- =============================================================================
-- ADMIN-LUMO-001 diagnostics — run AFTER applying 20260728_admin_lumo_rpc_rls.sql
-- on moments-locaux-dev with human OK.
--
-- Expected:
--   * moderator JWT can CRUD partners / partner_rewards
--   * standard user cannot write partners
--   * moderator can lookup + redeem Pass by code (when redemption flag on)
--   * moderator credit wrapper only allows event_published_approved / media_approved
--   * app_config gamification keys readable/writable by mod; other keys hidden
-- =============================================================================

-- 1) Policies present
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'partners',
  'partner_rewards',
  'user_partner_passes',
  'user_pass_progress',
  'app_config',
  'lumo_rules',
  'wallets',
  'lumo_transactions',
  'creator_boost_credits'
)
ORDER BY tablename, policyname;

-- 2) RPCs present + grants
SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_redeem_partner_pass',
    'admin_lookup_partner_pass',
    'moderator_credit_lumo_by_rule',
    'credit_lumo_by_rule',
    'is_gamification_config_key'
  )
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY p.proname, r.rolname;

-- 3) Manual checks (Dashboard → SQL as the relevant role / via client):
--
-- As moderator (authenticated + profiles.role moderateur|admin):
--   insert into partners (name, city, active) values ('Diag Partner', 'Test', false) returning id;
--   select * from app_config where key = 'gamification_enabled';
--   select * from app_config where key = 'supabase_project_url';  -- expect 0 rows
--   select public.admin_lookup_partner_pass('<code>');
--   select public.moderator_credit_lumo_by_rule(
--     '<user_uuid>', 'event_published_approved', 'event_published_approved:<event_id>', '{}'::jsonb
--   );
--   select public.moderator_credit_lumo_by_rule(
--     '<user_uuid>', 'checkin', 'should-fail', '{}'::jsonb
--   );  -- expect TRIGGER_NOT_ALLOWED
--
-- As standard authenticated user:
--   insert into partners (name) values ('hack');  -- expect RLS failure
--   update app_config set value = 'true' where key = 'gamification_enabled';  -- 0 rows
--   select public.admin_redeem_partner_pass('anything');  -- FORBIDDEN_NOT_MODERATOR
--   select public.credit_lumo_by_rule(...);  -- permission denied (service_role only)
--
-- Double redeem:
--   1) ensure partner_pass_redemption_enabled = true
--   2) insert test pass status=available with known redemption_code
--   3) admin_redeem_partner_pass(code) → ok
--   4) admin_redeem_partner_pass(code) → ok + idempotent=true
