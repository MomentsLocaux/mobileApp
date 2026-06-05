-- ============================================================================
-- Lot 2 — Secure public.profiles with RLS
-- STATUS: PROPOSAL — DO NOT APPLY WITHOUT EXPLICIT VALIDATION
-- (kept in supabase/diagnostics/ on purpose so it is NOT picked up by db push)
-- ============================================================================
--
-- CURRENT STATE (verified 2026-06-05):
--   RLS is DISABLED on public.profiles. Two policies exist but are INERT:
--     profiles_select_public     (SELECT, anon+authenticated, qual = true)
--     profiles_update_moderation (UPDATE, authenticated, is_moderator())
--   => Today the table is fully open: ANY caller (even anon) can read every
--      profile and INSERT/UPDATE/DELETE any row — including granting themselves
--      role='admin', flipping status, or clearing their own ban_until.
--      This is the P0 of this ticket.
--
-- PROFILE CREATION PATH (verified):
--   Client-side insert in mobileApp/src/data-provider/auth-provider.ts
--   -> ensureProfile(userId, email):
--        insert { id: userId (= auth.uid()), display_name, role:'particulier',
--                 status:'active', onboarding_completed:false, ... }
--   There is NO handle_new_user trigger on auth.users
--   (the only profiles trigger is trg_profiles_notify_ban).
--   => An INSERT policy is REQUIRED, otherwise sign-up / onboarding breaks.
--
-- DESIGN:
--   1. profiles_insert_self  -> a user may create ONLY their own row.
--   2. profiles_update_own   -> a user may update ONLY their own row.
--   3. enforce_profile_privilege_guard() trigger -> non-moderators cannot set
--      privileged columns (role / status / ban_until). On INSERT we force safe
--      defaults; on UPDATE we reject any change to those columns.
--      Moderators (is_moderator()) bypass the guard and keep full control via
--      the existing profiles_update_moderation policy. service_role bypasses RLS.
--   4. Enable RLS last.
--
-- OPEN QUESTIONS TO VALIDATE BEFORE APPLYING:
--   Q1. Role model (observed values in prod, 2026-06-05):
--         particulier(16), professionnel(16), institutionnel(10),
--         moderateur(12), admin(13), invite(4).
--       Privileged (must NOT be self-assignable): admin, moderateur
--       (probably also institutionnel). The current client always inserts
--       'particulier'. THIS PROPOSAL FORCES role='particulier' on self-insert,
--       which would break self-registration of professionnel/institutionnel
--       accounts and any client-side role upgrade. Before applying, confirm:
--         - which roles a user may self-select at insert/onboarding, and
--         - how upgrades to professionnel/institutionnel happen
--           (client UPDATE vs admin via WebConsole vs RPC/service_role).
--       Then replace the hard 'particulier' default with a whitelist check,
--       e.g. with check (role in ('particulier','professionnel','invite')) and
--       only block admin/moderateur (+institutionnel) self-assignment.
--   Q2. status enum values (observed): active(70), suspended(1).
--       'active' is the safe default; 'suspended' is moderator-only.
--   Q3. DELETE: no DELETE policy is added (account deletion is handled by the
--       account_deletion flow / service_role). Confirm no client deletes profiles.
-- ============================================================================

-- 1) A user may create ONLY their own profile row.
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- 2) A user may update ONLY their own profile row
--    (privileged columns are protected by the trigger below).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3) Privilege guard on sensitive columns.
create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  -- Moderators keep full control.
  if public.is_moderator() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Force safe defaults regardless of what the client submitted.
    new.role := 'particulier';      -- TODO(Q1): confirm self-selectable roles
    new.status := 'active';         -- TODO(Q2): confirm default status
    new.ban_until := null;
    return new;
  end if;

  -- UPDATE: reject any change to privileged columns by a non-moderator.
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.ban_until is distinct from old.ban_until then
    raise exception 'Modification de champ privilegie interdite (role/status/ban_until)';
  end if;

  return new;
end;
$func$;

create trigger trg_profiles_privilege_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_guard();

-- 4) Enable RLS (do this last).
alter table public.profiles enable row level security;
