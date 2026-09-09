-- SCRUM-203 — persist CGU / privacy acceptance on particulier signup.
-- Append-only. Do NOT apply without human validation (AGENTS.md).
-- legal_accepted_at currently exists only on contest_entries, not on profiles.

alter table public.profiles
  add column if not exists legal_accepted_at timestamptz,
  add column if not exists legal_policy_version text;

comment on column public.profiles.legal_accepted_at is
  'When the user last accepted CGU/privacy. Do not overwrite without a new legal_policy_version.';

comment on column public.profiles.legal_policy_version is
  'Accepted policy version (see src/constants/legal.ts LEGAL_POLICY_VERSION).';
