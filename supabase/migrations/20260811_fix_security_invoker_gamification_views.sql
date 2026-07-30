-- Fix CRITICAL advisor 0010: Security Definer View
-- Views in public must use security_invoker so RLS on underlying tables applies.
-- Applied remotely on moments-locaux-dev + moments-locaux-uat via MCP 2026-07-30.

ALTER VIEW public.contest_entries_view SET (security_invoker = true);
ALTER VIEW public.leaderboard_monthly_view SET (security_invoker = true);
ALTER VIEW public.mission_progress_view SET (security_invoker = true);
ALTER VIEW public.user_xp_levels SET (security_invoker = true);
