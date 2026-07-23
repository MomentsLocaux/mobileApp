-- =============================================================================
-- Diagnostics — AFTER applying 20260729_lumo_credit_on_event_published.sql
-- (event_held progressive credit) on DEV with human OK.
--
-- Expected:
--   * NO trigger trg_events_credit_lumo_on_published
--   * cron job award-completed-event-lumo present
--   * rule event_held active with tiers ; event_published_approved inactive
--   * published event with ends_at past → credit once (event_held:{id})
--   * archived/refused before end → no credit
--   * weekly_cap 2 skips further credits same UTC week
-- =============================================================================

-- 1) Publish trigger must be absent
SELECT tgname
FROM pg_trigger
WHERE tgname = 'trg_events_credit_lumo_on_published';
-- expect 0 rows

-- 2) Cron present
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'award-completed-event-lumo';

-- 3) Rules
SELECT code, amount, trigger_event, active, metadata -> 'tiers' AS tiers, metadata -> 'weekly_cap' AS weekly_cap
FROM public.lumo_rules
WHERE code IN ('event_held', 'event_published_approved')
   OR trigger_event IN ('event_held', 'event_published_approved');

-- 4) Tier helper smoke
SELECT public.lumo_amount_for_event_duration(
  1.5,
  (SELECT metadata -> 'tiers' FROM public.lumo_rules WHERE code = 'event_held')
) AS expect_20;

SELECT public.lumo_amount_for_event_duration(
  200,
  (SELECT metadata -> 'tiers' FROM public.lumo_rules WHERE code = 'event_held')
) AS expect_150;

-- 5) Manual scenario (service_role / SQL editor):
--   a) gamification_enabled = true
--   b) UPDATE events SET status='published', ends_at = now() - interval '1 hour'
--      WHERE id = '<event_id>' AND status = 'published';
--   c) SELECT public.credit_event_held_lumo('<event_id>');
--   d) SELECT * FROM lumo_transactions WHERE idempotency_key = 'event_held:<event_id>';
--   e) Re-call → idempotent
--   f) Archive another event before ends_at → credit skipped NOT_PUBLISHED / NOT_ENDED
