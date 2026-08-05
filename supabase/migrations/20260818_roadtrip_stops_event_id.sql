-- Roadtrip étape 3 — lien fiable étape ↔ événement programmé.
-- Sans cette colonne, la reprise devait matcher lat/lon (fragile).

ALTER TABLE public.roadtrip_stops
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roadtrip_stops_event
  ON public.roadtrip_stops (event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE public.roadtrip_stops
  DROP CONSTRAINT IF EXISTS roadtrip_stops_event_kind_check;

ALTER TABLE public.roadtrip_stops
  ADD CONSTRAINT roadtrip_stops_event_kind_check
  CHECK (
    (kind = 'event' AND event_id IS NOT NULL)
    OR (kind <> 'event' AND event_id IS NULL)
  );
