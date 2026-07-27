-- ADR_007 cleanup — remap legacy institutionnel → professionnel + pro_subtype.
-- DO NOT apply without human validation (AGENTS.md).
--
-- Verified intent (DEV previously had ~10 institutionnel rows):
--   Keep role_enum value `institutionnel` for historical reads / soft deprecation,
--   but stop writing it: trigger remaps to professionnel + default subtype.
--
-- Safe to re-run (idempotent updates).

-- 1) Data remap
update public.profiles
set
  role = 'professionnel',
  can_create = true,
  active_mode = 'create',
  pro_subtype = coalesce(pro_subtype, 'collectivite'),
  updated_at = now()
where role::text = 'institutionnel';

-- 2) Privilege guard: never persist institutionnel for self-service writes
create or replace function public.enforce_profile_privilege_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  -- institutionnel removed from self-assignable writes (ADR_007)
  allowed_roles text[] := array['particulier','professionnel','invite'];
begin
  if public.is_moderator()
     or auth.uid() is null
     or coalesce(current_setting('app.account_deletion', true) = 'on', false) then
    return new;
  end if;

  -- Soft remap legacy audience if a client still sends it
  if new.role::text = 'institutionnel' then
    new.role := 'professionnel';
    if new.pro_subtype is null then
      new.pro_subtype := 'collectivite';
    end if;
    new.can_create := true;
    new.active_mode := 'create';
  end if;

  if tg_op = 'INSERT' then
    if new.role is null or not (new.role::text = any(allowed_roles)) then
      new.role := 'particulier';
    end if;
    new.status := 'active';
    new.ban_until := null;
    return new;
  end if;

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

comment on function public.enforce_profile_privilege_guard() is
  'ADR_007: self-assignable roles exclude institutionnel; remaps legacy writes to professionnel.';
