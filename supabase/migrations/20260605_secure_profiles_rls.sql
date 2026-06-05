-- Lot 2 — Secure public.profiles with Row Level Security.
--
-- CONTEXT (verified 2026-06-05): RLS was DISABLED on public.profiles, so the
-- two existing policies (profiles_select_public, profiles_update_moderation)
-- were inert and ANY caller could read every profile and INSERT/UPDATE/DELETE
-- any row — including self-granting role='admin' or clearing their own ban.
--
-- VERIFIED CLIENT FLOWS:
--   * Creation: auth-provider.ts > ensureProfile() inserts { id = auth.uid(),
--     role:'particulier', status:'active', ... }. No handle_new_user trigger.
--   * Onboarding: OnboardingScreen.tsx updates the user's OWN profile and lets
--     them pick role in { particulier, professionnel, institutionnel }.
--   * Guest: "Continuer en tant qu'invité" creates a profile with role 'invite'.
--
-- POLICY MODEL:
--   Self-assignable roles (non-moderators): particulier, professionnel,
--   institutionnel, invite. Reserved (admin/service only): admin, moderateur.
--   status / ban_until are NEVER self-settable.
--   Moderators (is_moderator()), service_role (auth.uid() is null), and the
--   account-deletion flow (session flag app.account_deletion='on') bypass the
--   field-level guard. Enums: role=role_enum, status=profile_status_mod_enum.

-- 1) A user may create ONLY their own profile row.
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- 2) A user may update ONLY their own profile row
--    (privileged fields are protected by the trigger below).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3) Field-level privilege guard.
create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  allowed_roles text[] := array['particulier','professionnel','institutionnel','invite'];
begin
  -- Bypass for: moderators, server-side (service_role / no JWT user), and the
  -- account-deletion flow (process_account_deletion sets app.account_deletion='on'
  -- and legitimately sets profiles.status='suspended' during anonymisation).
  if public.is_moderator()
     or auth.uid() is null
     or coalesce(current_setting('app.account_deletion', true) = 'on', false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Non-privileged self-registration: clamp privileged fields.
    if new.role is null or not (new.role::text = any(allowed_roles)) then
      new.role := 'particulier';
    end if;
    new.status := 'active';
    new.ban_until := null;
    return new;
  end if;

  -- UPDATE by a non-moderator on their own row:
  --   role may only move within the self-assignable whitelist;
  --   status and ban_until must not change.
  if new.role is distinct from old.role
     and not (new.role::text = any(allowed_roles)) then
    raise exception 'Attribution de role privilegie interdite (%).', new.role;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Modification du statut interdite.';
  end if;
  if new.ban_until is distinct from old.ban_until then
    raise exception 'Modification de ban_until interdite.';
  end if;

  return new;
end;
$func$;

drop trigger if exists trg_profiles_privilege_guard on public.profiles;
create trigger trg_profiles_privilege_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_guard();

-- 4) Enable RLS (last).
alter table public.profiles enable row level security;
