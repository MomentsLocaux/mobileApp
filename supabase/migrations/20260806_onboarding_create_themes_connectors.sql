-- Applied on moments-locaux-dev (prymkgkafaovhzopslea) 2026-07-27 via MCP after schema check.
-- DO NOT apply to UAT/prod without human validation (AGENTS.md).
--
-- Décisions 2026-07-27 :
--   create_themes = prérempli / éditable / skip OK → creator_category_slugs
--   OT connect_sit = pending (sync Apidae = ADR 005 / OT-P0)
--   custom connector = lead Free, priorisation Pro
--
-- Depends on: 20260802_account_identity_adr007, 20260804_diffuseur_organizations

-- ---------------------------------------------------------------------------
-- profiles — B2C creator intent + categories to publish
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists create_intent text;

alter table public.profiles
  add column if not exists creator_category_slugs text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_create_intent_check'
  ) then
    alter table public.profiles
      add constraint profiles_create_intent_check
      check (
        create_intent is null
        or create_intent in ('talent', 'micro_vente', 'regulier')
      );
  end if;
end $$;

comment on column public.profiles.create_intent is
  'B2C onboarding create_why: talent | micro_vente | regulier (null if !can_create).';
comment on column public.profiles.creator_category_slugs is
  'B2C onboarding create_themes: event_category slugs the user plans to publish.';

-- ---------------------------------------------------------------------------
-- organizations — connector status (SIT / custom lead)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists connector_status text not null default 'none';

alter table public.organizations
  add column if not exists sit_provider text;

alter table public.organizations
  add column if not exists connector_request jsonb;

alter table public.organizations
  add column if not exists connector_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_connector_status_check'
  ) then
    alter table public.organizations
      add constraint organizations_connector_status_check
      check (
        connector_status in (
          'none',
          'sit_pending',
          'sit_connected',
          'custom_requested',
          'custom_active'
        )
      );
  end if;
end $$;

comment on column public.organizations.connector_status is
  'Diffuseur connector: none | sit_pending | sit_connected | custom_requested | custom_active.';
comment on column public.organizations.sit_provider is
  'OT SIT provider label (e.g. apidae) when connect_sit used.';
comment on column public.organizations.connector_request is
  'Custom connector lead payload: tool, url, contact, notes.';
comment on column public.organizations.connector_requested_at is
  'When custom lead or SIT pending was recorded.';
