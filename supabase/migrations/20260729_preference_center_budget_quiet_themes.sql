-- PREF-P0-001: Preference center — daily push budget, quiet hours, declared themes.
--
-- Scope (additive only):
--   - Global anti-spam budget (distinct from discovery_max_push_per_week).
--   - Quiet hours window (NULL = disabled).
--   - Declared category theme slugs for cold-start / soft nearby matching.
--   - No RLS changes (existing owner policies cover new columns).
--
-- Depends on: user_preferences (notifications push schema + DISC-P0-003).
-- Do NOT apply to production without human validation.

BEGIN;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS max_push_per_day smallint NOT NULL DEFAULT 3
    CHECK (max_push_per_day BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS quiet_hours_start time without time zone NULL,
  ADD COLUMN IF NOT EXISTS quiet_hours_end time without time zone NULL,
  ADD COLUMN IF NOT EXISTS preferred_category_slugs text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.user_preferences.max_push_per_day IS
  'Max push notifications per calendar day (Europe/Paris in push-dispatch MVP). 0 disables the daily cap. Distinct from discovery_max_push_per_week.';

COMMENT ON COLUMN public.user_preferences.quiet_hours_start IS
  'Local quiet-hours start (time). NULL with quiet_hours_end NULL means quiet hours disabled. May span midnight when start > end.';

COMMENT ON COLUMN public.user_preferences.quiet_hours_end IS
  'Local quiet-hours end (time). NULL with quiet_hours_start NULL means quiet hours disabled.';

COMMENT ON COLUMN public.user_preferences.preferred_category_slugs IS
  'Declared theme slugs (category visual slugs) for cold-start personalization and soft nearby fan-out filtering. Empty array = no theme filter.';

COMMIT;
