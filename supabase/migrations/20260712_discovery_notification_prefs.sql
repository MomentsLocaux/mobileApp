-- DISC-P0-003: Discovery notification preference columns on user_preferences.
--
-- Scope (additive only):
--   - Master toggle + per-family toggles for Discovery push (distinct from notify_event_nearby).
--   - Weekly anti-spam cap for Discovery pushes.
--   - No RLS changes (existing owner policies cover new columns).
--
-- Depends on: 20260710_discovery_domain_schema.sql
-- Do NOT apply to production without human validation.

BEGIN;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS discovery_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS right_now_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS break_loop_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS life_insight_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_max_push_per_week smallint NOT NULL DEFAULT 3
    CHECK (discovery_max_push_per_week BETWEEN 0 AND 14);

COMMENT ON COLUMN public.user_preferences.discovery_push_enabled IS
  'Master toggle for Discovery notification families (distinct from notify_event_nearby).';
COMMENT ON COLUMN public.user_preferences.right_now_push_enabled IS
  'Discovery Right Now opportunity pushes (requires discovery_push_enabled).';
COMMENT ON COLUMN public.user_preferences.break_loop_push_enabled IS
  'Discovery Break the Loop suggestion pushes (requires discovery_push_enabled).';
COMMENT ON COLUMN public.user_preferences.life_insight_push_enabled IS
  'Discovery life-pattern insight pushes (requires discovery_push_enabled).';
COMMENT ON COLUMN public.user_preferences.discovery_max_push_per_week IS
  'Max Discovery push notifications per rolling 7-day window (0 disables cap enforcement).';

COMMIT;
