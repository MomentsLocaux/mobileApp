-- SCRUM-103 — Lumia chat monthly quota (20/user/calendar month UTC)
-- Written only by Edge Function lumia-chat (service role).

create table if not exists public.lumia_chat_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_ym text not null check (period_ym ~ '^[0-9]{4}-[0-9]{2}$'),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_ym)
);

alter table public.lumia_chat_usage enable row level security;

-- Defense in depth: no Data API access for clients (Edge uses service role).
revoke all on table public.lumia_chat_usage from anon, authenticated;
grant all on table public.lumia_chat_usage to service_role;

comment on table public.lumia_chat_usage is
  'Lumia chatbot monthly request counters (default limit 20/user/month UTC); written by Edge Function lumia-chat only.';
