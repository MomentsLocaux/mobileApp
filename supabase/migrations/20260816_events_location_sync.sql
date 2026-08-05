-- Roadtrip étape 2 — correctif découvert en dev : events.location (geography)
-- n'était renseignée que sur 192 lignes sur ~22 000. Le backfill initial
-- (archive 202511272300) n'avait jamais été suivi d'un trigger : les
-- ingestions n'alimentent que latitude/longitude.
--
-- Impact au-delà du roadtrip : le fan-out de notifications de proximité et
-- toute requête PostGIS sur events.location étaient silencieusement dégradés.
--
-- 1. Trigger BEFORE INSERT/UPDATE qui dérive location de latitude/longitude.
-- 2. Backfill des lignes existantes.

CREATE OR REPLACE FUNCTION public.sync_event_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL
     AND NEW.longitude IS NOT NULL
     AND NOT (NEW.latitude = 0 AND NEW.longitude = 0) THEN
    NEW.location := st_setsrid(st_makepoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_sync_location ON public.events;
CREATE TRIGGER trg_events_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.events
FOR EACH ROW EXECUTE FUNCTION public.sync_event_location();

-- Backfill : session_replication_role=replica (portée transaction) pour ne pas
-- déclencher enforce_event_lifecycle (qui exige auth.uid() = creator) ni bumper
-- updated_at sur ~22 000 lignes.
SET LOCAL session_replication_role = replica;

UPDATE public.events
SET location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND NOT (latitude = 0 AND longitude = 0);

SET LOCAL session_replication_role = DEFAULT;
