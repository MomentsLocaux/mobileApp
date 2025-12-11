-- Enable PostGIS and add GEOGRAPHY(point,4326) columns with data migration
-- Idempotent and safe to run multiple times

------------------------------------------------------------
-- 1. Extension PostGIS
------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;


------------------------------------------------------------
-- 2. Colonnes location (syntaxe correcte GEOGRAPHY(point,4326))
------------------------------------------------------------
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS location GEOGRAPHY(point, 4326);

ALTER TABLE public.event_checkins
ADD COLUMN IF NOT EXISTS location GEOGRAPHY(point, 4326);


------------------------------------------------------------
-- 3. Migration des données existantes
-- ST_MakePoint(lat, lon) → geometry
-- ST_SetSRID → geometry
-- Cast final → geography
------------------------------------------------------------
UPDATE public.events
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL
  AND longitude IS NOT NULL
  AND latitude IS NOT NULL;

UPDATE public.event_checkins
SET location = ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
WHERE location IS NULL
  AND lon IS NOT NULL
  AND lat IS NOT NULL;


------------------------------------------------------------
-- 4. Index GiST (geography compatible)
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_location
ON public.events
USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_event_checkins_location
ON public.event_checkins
USING GIST (location);


------------------------------------------------------------
-- 5. Bonus : index sur category
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_category
ON public.events (category);


------------------------------------------------------------
-- 6. Contraintes CHECK pour valider le type (géographie → cast en geometry)
------------------------------------------------------------
ALTER TABLE public.events
  ADD CONSTRAINT events_location_type_check
  CHECK (
    location IS NULL
    OR ST_GeometryType(location::geometry) = 'ST_Point'
  )
  NOT VALID;

ALTER TABLE public.event_checkins
  ADD CONSTRAINT event_checkins_location_type_check
  CHECK (
    location IS NULL
    OR ST_GeometryType(location::geometry) = 'ST_Point'
  )
  NOT VALID;
