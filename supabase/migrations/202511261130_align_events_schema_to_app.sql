-- Align events/event_media schema with fields used in the mobile app screens

-- events: add missing fields used in creation/form logic
alter table public.events
  add column if not exists schedule_mode text,
  add column if not exists recurrence_rule text,
  add column if not exists updated_at timestamptz default now();

-- event_media: align with EventMedia type (type, order)
alter table public.event_media
  add column if not exists type text,
  add column if not exists "order" integer;

-- optional: keep updated_at current on change (no-op if already present)
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_public_events_updated_at on public.events;
create trigger set_public_events_updated_at
before update on public.events
for each row
execute function public.set_current_timestamp_updated_at();
