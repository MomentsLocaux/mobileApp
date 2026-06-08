-- Lot 1 — Notifications: schema foundations for push delivery + preferences.
--
-- Scope of this migration (schema only, additive, non-destructive):
--   1. Device push token storage (Expo push tokens) with owner-only RLS.
--   2. Extend public.user_preferences with geo radius / frequency / per-type toggles.
--   3. Register two new notification types used by upcoming triggers (Lot 3).
--
-- This migration intentionally contains NO trigger, fan-out or delivery logic.
-- Delivery (Edge Function + Expo) = Lot 2, triggers = Lot 3, scheduling = Lot 6.

-- ---------------------------------------------------------------------------
-- 1) Device push tokens
-- ---------------------------------------------------------------------------
create table if not exists public.device_push_tokens (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users (id) on delete cascade,
    token        text not null,
    platform     text not null check (platform in ('ios', 'android', 'web')),
    device_name  text,
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    constraint device_push_tokens_token_key unique (token)
);

create index if not exists idx_device_push_tokens_user_id
    on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

-- A user can fully manage only their own device tokens. The server (service_role)
-- bypasses RLS and will read tokens when dispatching push (Lot 2).
drop policy if exists device_push_tokens_select_own on public.device_push_tokens;
create policy device_push_tokens_select_own
    on public.device_push_tokens for select to authenticated
    using (user_id = auth.uid());

drop policy if exists device_push_tokens_insert_own on public.device_push_tokens;
create policy device_push_tokens_insert_own
    on public.device_push_tokens for insert to authenticated
    with check (user_id = auth.uid());

drop policy if exists device_push_tokens_update_own on public.device_push_tokens;
create policy device_push_tokens_update_own
    on public.device_push_tokens for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists device_push_tokens_delete_own on public.device_push_tokens;
create policy device_push_tokens_delete_own
    on public.device_push_tokens for delete to authenticated
    using (user_id = auth.uid());

comment on table public.device_push_tokens is 'Expo push tokens per user device, used by the push-dispatch Edge Function (Lot 2).';

-- ---------------------------------------------------------------------------
-- 2) Extend notification preferences
-- ---------------------------------------------------------------------------
-- Existing columns: push_enabled, email_enabled, notify_event_nearby,
-- notify_rewards, notify_social, updated_at. Add geo radius/frequency and the
-- two per-type toggles needed by the in-scope notifications.
alter table public.user_preferences
    add column if not exists notify_radius_km integer not null default 25
        check (notify_radius_km between 1 and 200),
    add column if not exists notify_frequency text not null default 'instant'
        check (notify_frequency in ('instant', 'daily', 'weekly')),
    add column if not exists notify_followed_creator boolean not null default true,
    add column if not exists notify_event_reminders boolean not null default true;

comment on column public.user_preferences.notify_radius_km is 'Radius (km) for geolocated "new nearby event" notifications.';
comment on column public.user_preferences.notify_frequency is 'Delivery cadence for batched notifications: instant | daily | weekly.';
comment on column public.user_preferences.notify_followed_creator is 'Notify when a followed creator publishes an event.';
comment on column public.user_preferences.notify_event_reminders is 'Notify with reminders before a saved/created event starts.';

-- ---------------------------------------------------------------------------
-- 3) New notification types (consumed by Lot 3 triggers)
-- ---------------------------------------------------------------------------
-- IF NOT EXISTS keeps this idempotent; values are not referenced in this file.
alter type public.notification_type_mod_enum add value if not exists 'event_nearby_new';
alter type public.notification_type_mod_enum add value if not exists 'followed_creator_published';
