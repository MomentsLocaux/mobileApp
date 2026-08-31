-- Partner Pass Lumo — allow profiles.pro_subtype = 'partenaire' (ADR_007).
-- DO NOT apply without human validation (AGENTS.md).
--
-- Verified live DEV 2026-08-18 (project prymkgkafaovhzopslea / moments-locaux-dev):
--   role_enum already includes professionnel (26 profiles).
--   profiles_pro_subtype_check = independant | association | lieu |
--     office_tourisme | collectivite — partenaire ABSENT.
--   organizations_pro_subtype_check = same Diffuseur list. Intentionally
--     NOT extended: a Partenaire is Professionnel + subtype partenaire,
--     not a Diffuseur organization.
--   prospect_leads.segment already allows 'partenaire' (CRM outbound only).
--
-- First signup still uses supabase.auth.signUp → same Auth confirm-signup
-- email as any user. Profile write after confirm:
--   role = professionnel, pro_subtype = partenaire.

alter table public.profiles
  drop constraint if exists profiles_pro_subtype_check;

alter table public.profiles
  add constraint profiles_pro_subtype_check
  check (
    pro_subtype is null
    or pro_subtype in (
      'independant',
      'association',
      'lieu',
      'office_tourisme',
      'collectivite',
      'partenaire'
    )
  );

comment on column public.profiles.pro_subtype is
  'ADR_007: typology under Professionnel (independant | association | lieu | office_tourisme | collectivite | partenaire). Null for Particulier. partenaire = Pass Lumo merchant, not Diffuseur.';
