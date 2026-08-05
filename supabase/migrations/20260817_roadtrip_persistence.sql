-- Roadtrip — étape 3 : persistance des voyages.
-- Tables owner-only : roadtrips, roadtrip_stops, roadtrip_events.
--
-- Sécurité :
-- - RLS propriétaire uniquement, via (select auth.uid()) = user_id
--   (jointure sur roadtrips pour stops/events).
-- - Suppression en cascade avec le compte (auth.users) et avec le roadtrip.
-- - Aucune service_role requise côté client.

CREATE TABLE public.roadtrips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  transport_mode text NOT NULL DEFAULT 'driving' CHECK (transport_mode = 'driving'),
  departure_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  preferences jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roadtrip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadtrip_id uuid NOT NULL REFERENCES public.roadtrips(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 31),
  kind text NOT NULL CHECK (kind IN ('origin', 'stop', 'destination', 'event')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  arrival_at timestamptz,
  departure_at timestamptz,
  UNIQUE (roadtrip_id, position)
);

CREATE TABLE public.roadtrip_events (
  roadtrip_id uuid NOT NULL REFERENCES public.roadtrips(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  leg_index integer NOT NULL DEFAULT 0 CHECK (leg_index BETWEEN 0 AND 63),
  planned_arrival_at timestamptz,
  planned_duration_minutes integer CHECK (planned_duration_minutes BETWEEN 0 AND 1440),
  estimated_detour_minutes integer CHECK (estimated_detour_minutes BETWEEN 0 AND 600),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'removed')),
  PRIMARY KEY (roadtrip_id, event_id)
);

CREATE INDEX idx_roadtrips_user ON public.roadtrips (user_id, created_at DESC);
CREATE INDEX idx_roadtrip_stops_roadtrip ON public.roadtrip_stops (roadtrip_id, position);
CREATE INDEX idx_roadtrip_events_event ON public.roadtrip_events (event_id);

CREATE TRIGGER set_public_roadtrips_updated_at
BEFORE UPDATE ON public.roadtrips
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.roadtrips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadtrip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadtrip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY roadtrips_owner_select ON public.roadtrips
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY roadtrips_owner_insert ON public.roadtrips
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY roadtrips_owner_update ON public.roadtrips
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY roadtrips_owner_delete ON public.roadtrips
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY roadtrip_stops_owner_all ON public.roadtrip_stops
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.roadtrips r
    WHERE r.id = roadtrip_id AND r.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roadtrips r
    WHERE r.id = roadtrip_id AND r.user_id = (SELECT auth.uid())
  ));

CREATE POLICY roadtrip_events_owner_all ON public.roadtrip_events
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.roadtrips r
    WHERE r.id = roadtrip_id AND r.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roadtrips r
    WHERE r.id = roadtrip_id AND r.user_id = (SELECT auth.uid())
  ));
