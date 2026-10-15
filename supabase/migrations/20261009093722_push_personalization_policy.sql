-- Onboarding push policy snapshot on user_preferences.
-- Live delivery follows notify_event_nearby, notify_event_reminders and
-- notify_proximity_live. Discovery is not part of this policy.
--
-- Applied on DEV 2026-10-15 (prymkgkafaovhzopslea). UAT/prod not applied.

BEGIN;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS push_personalization jsonb;

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_push_personalization_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_push_personalization_check
  CHECK (
    push_personalization IS NULL
    OR (
      jsonb_typeof(push_personalization) = 'object'
      AND push_personalization->>'version' = '1'
      AND push_personalization->>'policy' IN ('essentiel', 'local')
    )
  );

COMMENT ON COLUMN public.user_preferences.push_personalization IS
  'Onboarding questionnaire snapshot (version 1: policy essentiel|local, answered_at). Live delivery uses notify_event_nearby, notify_event_reminders and notify_proximity_live written at the same time.';

COMMIT;
