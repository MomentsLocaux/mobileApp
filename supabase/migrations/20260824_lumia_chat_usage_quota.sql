-- SCRUM-103 — Lumia chat monthly quota (draft — do NOT apply without human validation)
-- Tracks authenticated user requests per calendar month (UTC).

create table if not exists public.lumia_chat_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_ym text not null check (period_ym ~ '^[0-9]{4}-[0-9]{2}$'),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_ym)
);

alter table public.lumia_chat_usage enable row level security;

-- No client policies: only service role (Edge Function) reads/writes usage.
comment on table public.lumia_chat_usage is
  'Lumia chatbot monthly request counters; written by Edge Function lumia-chat only.';
