-- Add missing event columns used by the app (location, capacity, contact, pricing)
alter table public.events
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists venue_name text,
  add column if not exists registration_required boolean default false,
  add column if not exists max_participants integer,
  add column if not exists external_url text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists price numeric;

-- Indexes to keep event listing fast
create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_events_creator_id on public.events(creator_id);
create index if not exists idx_event_media_event_id on public.event_media(event_id);
