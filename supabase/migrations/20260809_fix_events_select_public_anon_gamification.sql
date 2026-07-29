-- Hotfix: anon SELECT on events fails with
--   permission denied for function is_gamification_enabled (42501)
--
-- Root cause:
--   20260726_lumo_early_access_events.sql rewrote events_select_public (TO anon)
--   to call public.is_gamification_enabled() in the USING clause.
--   20260722_lumo_economy_rpc_hardening.sql intentionally REVOKE'd EXECUTE on that
--   function from anon (only authenticated + service_role). SECURITY DEFINER does
--   not bypass the caller's need for EXECUTE privilege.
--
--   Webapp map (listEventsByBBox → SELECT events) uses the anon key when logged out
--   → RLS events_select_public → is_gamification_enabled() → 42501.
--
-- Fix:
--   Align anon policy with authenticated: use can_view_event(id) (SECURITY DEFINER,
--   already GRANT EXECUTE TO anon). Nested is_gamification_enabled runs as owner.
--   Behaviour for guests matches the previous intent (early-access rows hidden while
--   the window is active; all public published rows when gamification is off).
--
-- DO NOT apply without human validation (AGENTS.md). Apply DEV first, then UAT/prod.

BEGIN;

DROP POLICY IF EXISTS events_select_public ON public.events;
CREATE POLICY events_select_public
  ON public.events
  FOR SELECT
  TO anon
  USING (public.can_view_event(id));

COMMIT;
