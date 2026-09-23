-- SCRUM-279 — server-side proof that the user was informed before IA processing.
-- Append-only. Do NOT apply without human validation (AGENTS.md).
--
-- AsyncStorage alone does not survive a reinstall. One row per (user, kind).

create table if not exists public.ai_processing_notices (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  accepted_at timestamptz not null default now(),
  notice_version text not null,
  created_at timestamptz not null default now(),
  constraint ai_processing_notices_kind_check check (kind in ('poster', 'lumia')),
  constraint ai_processing_notices_pkey primary key (user_id, kind)
);

comment on table public.ai_processing_notices is
  'SCRUM-279: Art. 7 proof of the poster / Lumia IA notice. Not a substitute for legal_accepted_at.';

alter table public.ai_processing_notices enable row level security;

drop policy if exists ai_processing_notices_select_own on public.ai_processing_notices;
create policy ai_processing_notices_select_own
  on public.ai_processing_notices
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_processing_notices_insert_own on public.ai_processing_notices;
create policy ai_processing_notices_insert_own
  on public.ai_processing_notices
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ai_processing_notices_update_own on public.ai_processing_notices;
create policy ai_processing_notices_update_own
  on public.ai_processing_notices
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.ai_processing_notices to authenticated;
