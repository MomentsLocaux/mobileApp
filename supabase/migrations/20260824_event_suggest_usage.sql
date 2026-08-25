-- SCRUM-106 — Event suggest from poster: monthly IA usage quota
-- Tracks authenticated user poster analyses per calendar month (UTC).

create table if not exists public.event_suggest_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_ym text not null check (period_ym ~ '^[0-9]{4}-[0-9]{2}$'),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_ym)
);

alter table public.event_suggest_usage enable row level security;

-- No client policies: only service role (Edge Function suggest-event-from-poster) reads/writes usage.
comment on table public.event_suggest_usage is
  'Poster-to-event suggestion monthly analysis counters (default limit 20/user/month UTC); written by Edge Function suggest-event-from-poster only.';
