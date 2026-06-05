-- Lot 1 — Enable Row Level Security on ingestion/reference tables.
--
-- Context: these tables had RLS DISABLED, which means their existing policies
-- (if any) were inert and the tables were fully exposed to the `anon` and
-- `authenticated` roles (read AND write).
--
-- Effect of enabling RLS:
--   * event_subcategory / event_tag: keep their existing public SELECT policies
--     (anon + authenticated), so taxonomy reads on mobile and scraper keep
--     working. With no INSERT/UPDATE/DELETE policy, writes are now blocked for
--     anon/authenticated (only the service_role / catalog admin can mutate them).
--   * event_import_staging: has no policy, so enabling RLS fully locks it down
--     for anon/authenticated. The scraper writes/reads it with the
--     SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--
-- Verified: mobileApp (taxonomyStore) and scraper (CategorizationService) only
-- SELECT event_subcategory/event_tag; the WebConsole does not touch any of these
-- three tables. No client INSERT path exists, so enabling RLS is non-breaking.

alter table public.event_import_staging enable row level security;
alter table public.event_subcategory enable row level security;
alter table public.event_tag enable row level security;
