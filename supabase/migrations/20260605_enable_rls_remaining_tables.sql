-- Lot 3 — Enable RLS on the remaining unprotected public tables.
--
-- Verified (2026-06-05): none of contest_reports / enum_types / enum_values /
-- enum_value_translations / _migrations are referenced by table name in
-- mobileApp, the scraper, or the WebConsole.
--
--   * enum_* (reference / i18n data): get a public SELECT policy so any read
--     (direct or via RPC) keeps working; writes are locked to service_role/admin.
--   * contest_reports: locked to service_role only, consistent with the sibling
--     contest_* tables (already RLS on, no anon/authenticated policy).
--   * _migrations: internal ledger, locked to service_role only.

-- Reference / i18n: world-readable, writes via service_role only.
alter table public.enum_types enable row level security;
create policy enum_types_select_public
  on public.enum_types for select to anon, authenticated using (true);

alter table public.enum_values enable row level security;
create policy enum_values_select_public
  on public.enum_values for select to anon, authenticated using (true);

alter table public.enum_value_translations enable row level security;
create policy enum_value_translations_select_public
  on public.enum_value_translations for select to anon, authenticated using (true);

-- Internal / service-only (service_role bypasses RLS).
alter table public.contest_reports enable row level security;
alter table public._migrations enable row level security;
