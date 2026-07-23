-- =============================================================================
-- Diagnostics — AFTER applying 20260729_lumo_credit_on_event_published.sql
-- on DEV with human OK.
--
-- Expected:
--   * trigger trg_events_credit_lumo_on_published exists
--   * credit_lumo_by_rule honors weekly_cap (skips with WEEKLY_CAP)
--   * pending → published with gamification_enabled=true credits 50 Lumo once
--   * replay / re-publish path is idempotent (same event_id key)
--   * gamification_enabled=false → skipped, no wallet change
-- =============================================================================

-- 1) Trigger present
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'trg_events_credit_lumo_on_published';

-- 2) Rule active
SELECT code, amount, trigger_event, active, metadata
FROM public.lumo_rules
WHERE trigger_event = 'event_published_approved';

-- 3) Manual scenario (replace UUIDs; run as service_role / SQL editor):
--   a) ensure gamification_enabled = true
--   b) pick a pending event owned by a test creator
--   c) UPDATE events SET status = 'published' WHERE id = '<event_id>';
--   d) SELECT * FROM lumo_transactions
--      WHERE idempotency_key = 'event_published_approved:<event_id>';
--   e) re-run UPDATE (noop status) or call credit_lumo_by_rule again → idempotent

-- 4) Weekly cap smoke (optional):
--   Insert/simulate 2 credits with source=event_published_approved this week,
--   then third credit_lumo_by_rule should return skipped reason WEEKLY_CAP.
