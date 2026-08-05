-- Tests RLS roadtrip — owner vs non-owner.
-- Exécution : psql / SQL editor / MCP execute_sql sur un projet où
-- 20260817_roadtrip_persistence.sql est appliquée.
-- Remplacer :USER_A et :USER_B par deux uuid réels de auth.users.
-- La transaction est intégralement annulée (ROLLBACK) : aucune donnée ne reste.
--
-- Dernière exécution : 2026-08-05 sur moments-locaux-dev — 11/11 pass.

BEGIN;
CREATE TEMP TABLE rls_results (test text, pass boolean) ON COMMIT DROP;
GRANT ALL ON rls_results TO authenticated;

SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":":USER_A","role":"authenticated"}', true);

INSERT INTO public.roadtrips (id, user_id, name, departure_at)
VALUES ('11111111-2222-3333-4444-555555555555', ':USER_A', 'RLS test trip', now() + interval '2 days');
INSERT INTO public.roadtrip_stops (roadtrip_id, position, kind, label, latitude, longitude)
VALUES ('11111111-2222-3333-4444-555555555555', 0, 'origin', 'Paris', 48.8566, 2.3522);
INSERT INTO public.roadtrip_events (roadtrip_id, event_id, leg_index)
SELECT '11111111-2222-3333-4444-555555555555', e.id, 0
FROM public.events e WHERE e.status = 'published' AND e.visibility = 'public' LIMIT 1;

INSERT INTO rls_results
SELECT 'owner_sees_trip', count(*) = 1 FROM public.roadtrips WHERE id = '11111111-2222-3333-4444-555555555555';
INSERT INTO rls_results
SELECT 'owner_sees_stops', count(*) = 1 FROM public.roadtrip_stops WHERE roadtrip_id = '11111111-2222-3333-4444-555555555555';
INSERT INTO rls_results
SELECT 'owner_sees_events', count(*) = 1 FROM public.roadtrip_events WHERE roadtrip_id = '11111111-2222-3333-4444-555555555555';
WITH u AS (UPDATE public.roadtrips SET name = 'RLS test trip 2' WHERE id = '11111111-2222-3333-4444-555555555555' RETURNING 1)
INSERT INTO rls_results SELECT 'owner_can_update', count(*) = 1 FROM u;

SELECT set_config('request.jwt.claims', '{"sub":":USER_B","role":"authenticated"}', true);

INSERT INTO rls_results
SELECT 'nonowner_sees_no_trip', count(*) = 0 FROM public.roadtrips WHERE id = '11111111-2222-3333-4444-555555555555';
INSERT INTO rls_results
SELECT 'nonowner_sees_no_stops', count(*) = 0 FROM public.roadtrip_stops WHERE roadtrip_id = '11111111-2222-3333-4444-555555555555';
INSERT INTO rls_results
SELECT 'nonowner_sees_no_events', count(*) = 0 FROM public.roadtrip_events WHERE roadtrip_id = '11111111-2222-3333-4444-555555555555';
WITH u AS (UPDATE public.roadtrips SET name = 'hacked' WHERE id = '11111111-2222-3333-4444-555555555555' RETURNING 1)
INSERT INTO rls_results SELECT 'nonowner_cannot_update', count(*) = 0 FROM u;
WITH d AS (DELETE FROM public.roadtrips WHERE id = '11111111-2222-3333-4444-555555555555' RETURNING 1)
INSERT INTO rls_results SELECT 'nonowner_cannot_delete', count(*) = 0 FROM d;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.roadtrip_stops (roadtrip_id, position, kind, label, latitude, longitude)
    VALUES ('11111111-2222-3333-4444-555555555555', 1, 'stop', 'Intrusion', 45, 4);
    INSERT INTO rls_results VALUES ('nonowner_stop_insert_blocked', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO rls_results VALUES ('nonowner_stop_insert_blocked', true);
  END;
  BEGIN
    INSERT INTO public.roadtrips (user_id, name, departure_at)
    VALUES (':USER_A', 'Spoof', now());
    INSERT INTO rls_results VALUES ('nonowner_spoof_insert_blocked', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO rls_results VALUES ('nonowner_spoof_insert_blocked', true);
  END;
END $$;

SELECT * FROM rls_results ORDER BY test;
ROLLBACK;
