-- SCRUM-108+ — Distinguish organizer create vs community poster suggestion.
-- Draft — apply after human validation (same pattern as other 20260824 migrations).

alter table public.events
  add column if not exists submission_source text not null default 'organizer_create'
  check (submission_source in ('organizer_create', 'community_suggest'));

comment on column public.events.submission_source is
  'Entry intent: organizer_create (standard publish) or community_suggest (poster / IA prefill).';
