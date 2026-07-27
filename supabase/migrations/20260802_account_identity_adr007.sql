-- ID-ONBOARD / ADR_007 — identity fields on profiles (soft migration).
-- DO NOT apply without human validation (AGENTS.md).
--
-- Adds:
--   can_create   — B2C optional creator intent (Professionnel always true in app)
--   active_mode  — discover | create (B2C switch; Professionnel stays create)
--   pro_subtype  — typology under Professionnel only
--
-- Does NOT remove role enum value institutionnel (legacy read); new onboarding
-- never writes institutionnel (maps to professionnel + pro_subtype).
--
-- Verified live DEV 2026-07-26 (project prymkgkafaovhzopslea / moments-locaux-dev):
--   information_schema.columns on public.profiles — existing columns only:
--     id, role (role_enum), display_name, avatar_url, created_at, updated_at,
--     bio, city, region, onboarding_completed, cover_url, facebook_url,
--     instagram_url, tiktok_url, status (profile_status_mod_enum), ban_until
--   can_create / active_mode / pro_subtype: ABSENT (safe to add)
--   role_enum labels: particulier, professionnel, institutionnel, moderateur,
--     admin, invite (institutionnel kept for legacy reads)
--   Email: not on public.profiles — lives in auth.users (expected; client may
--     join/display via auth session, not a profiles column)

alter table public.profiles
  add column if not exists can_create boolean not null default false;

alter table public.profiles
  add column if not exists active_mode text not null default 'discover';

alter table public.profiles
  add column if not exists pro_subtype text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_active_mode_check
      check (active_mode in ('discover', 'create'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pro_subtype_check'
  ) then
    alter table public.profiles
      add constraint profiles_pro_subtype_check
      check (
        pro_subtype is null
        or pro_subtype in (
          'independant',
          'association',
          'lieu',
          'office_tourisme',
          'collectivite'
        )
      );
  end if;
end $$;

comment on column public.profiles.can_create is
  'ADR_007: Particulier may opt into local creation; Professionnel treated as true in app.';
comment on column public.profiles.active_mode is
  'ADR_007: B2C UI mode discover|create; create only meaningful if can_create.';
comment on column public.profiles.pro_subtype is
  'ADR_007: typology under Professionnel; null for Particulier.';

-- Backfill: legacy institutionnel / professionnel → can_create true, mode create
update public.profiles
set
  can_create = true,
  active_mode = 'create',
  pro_subtype = case
    when role::text = 'professionnel' and pro_subtype is null then 'independant'
    when role::text = 'institutionnel' and pro_subtype is null then 'collectivite'
    else pro_subtype
  end
where role::text in ('professionnel', 'institutionnel');
