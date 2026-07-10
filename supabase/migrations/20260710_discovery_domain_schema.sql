-- DISC-P0-001: Discovery Engine domain schema (additive, plug-in module).
--
-- Scope:
--   - New discovery_* tables, user_subscriptions, event_recommendations funnel.
--   - No changes to profiles, events, or engagement tables.
--
-- Requires: PostGIS (extensions schema) — see 20260610_enable_postgis_for_home_location.sql
--
-- Do NOT apply to production without human validation.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.discovery_place_type AS ENUM (
    'probable_home',
    'probable_work',
    'recurring',
    'occasional',
    'discovered'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discovery_visit_source AS ENUM (
    'passive',
    'checkin',
    'inferred'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discovery_transport_mode AS ENUM (
    'stationary',
    'walking',
    'cycling',
    'driving',
    'transit',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.recommendation_type AS ENUM (
    'right_now',
    'for_you',
    'break_the_loop',
    'nearby_opportunity',
    'new_area',
    'weekly_pick'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.recommendation_event_type AS ENUM (
    'generated',
    'eligible',
    'displayed',
    'opened',
    'dismissed',
    'saved',
    'interested',
    'route_requested',
    'probable_visit',
    'confirmed_checkin',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discovery_insight_type AS ENUM (
    'no_new_place_recently',
    'expanding_radius',
    'shrinking_radius',
    'repetitive_weekends',
    'unusual_day',
    'new_area',
    'high_variety_period'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trialing',
    'active',
    'grace_period',
    'expired',
    'cancelled',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_provider AS ENUM (
    'apple',
    'google',
    'stripe',
    'revenuecat',
    'internal'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- user_subscriptions — Premium source of truth (server writes only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider                   public.subscription_provider NOT NULL,
  product_id                 text NOT NULL,
  entitlement                text NOT NULL DEFAULT 'moments_locaux_plus',
  status                     public.subscription_status NOT NULL DEFAULT 'expired',
  started_at                 timestamptz,
  expires_at                 timestamptz,
  auto_renew                 boolean NOT NULL DEFAULT false,
  trial_ends_at              timestamptz,
  provider_customer_id       text,
  provider_subscription_id   text,
  metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_user_entitlement_key UNIQUE (user_id, entitlement)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON public.user_subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at
  ON public.user_subscriptions (expires_at)
  WHERE status IN ('active', 'grace_period', 'trialing');

COMMENT ON TABLE public.user_subscriptions IS
  'Server-side Premium entitlement. Client read-only; writes via subscription webhook (service_role).';

-- ---------------------------------------------------------------------------
-- discovery_consents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_consents (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  enabled                 boolean NOT NULL DEFAULT false,
  location_enabled        boolean NOT NULL DEFAULT false,
  motion_enabled          boolean NOT NULL DEFAULT false,
  personalization_enabled boolean NOT NULL DEFAULT false,
  consent_version         text NOT NULL DEFAULT '1.0',
  granted_at              timestamptz,
  revoked_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_consents_version_check CHECK (consent_version ~ '^[0-9]+\.[0-9]+$')
);

COMMENT ON TABLE public.discovery_consents IS
  'Discovery opt-in state. Distinct from Premium and from user_preferences.home_location.';

-- ---------------------------------------------------------------------------
-- discovery_places
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_places (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  location               geography(Point, 4326) NOT NULL,
  centroid_latitude      double precision NOT NULL,
  centroid_longitude     double precision NOT NULL,
  radius_meters          integer NOT NULL DEFAULT 120
    CHECK (radius_meters BETWEEN 30 AND 2000),
  place_type             public.discovery_place_type NOT NULL DEFAULT 'occasional',
  confidence             real NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  label                  text,
  first_seen_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at           timestamptz NOT NULL DEFAULT now(),
  visit_count            integer NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  total_duration_minutes integer NOT NULL DEFAULT 0 CHECK (total_duration_minutes >= 0),
  is_new                 boolean NOT NULL DEFAULT true,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_places_user_id
  ON public.discovery_places (user_id);

CREATE INDEX IF NOT EXISTS idx_discovery_places_user_last_seen
  ON public.discovery_places (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_places_location
  ON public.discovery_places USING gist (location);

COMMENT ON TABLE public.discovery_places IS
  'Inferred significant places. Labels are generic; probable_home/work are inferences only.';

-- ---------------------------------------------------------------------------
-- discovery_visits (recommendation_id FK added after event_recommendations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_visits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  place_id          uuid REFERENCES public.discovery_places (id) ON DELETE SET NULL,
  client_visit_id   text,
  arrived_at        timestamptz NOT NULL,
  departed_at       timestamptz,
  duration_minutes  integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  transport_mode    public.discovery_transport_mode NOT NULL DEFAULT 'unknown',
  confidence        real NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  probable_event_id uuid REFERENCES public.events (id) ON DELETE SET NULL,
  recommendation_id uuid,
  source            public.discovery_visit_source NOT NULL DEFAULT 'passive',
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_visits_departure_after_arrival
    CHECK (departed_at IS NULL OR departed_at >= arrived_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_visits_client_idempotency
  ON public.discovery_visits (user_id, client_visit_id)
  WHERE client_visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discovery_visits_user_arrived
  ON public.discovery_visits (user_id, arrived_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_visits_place_id
  ON public.discovery_visits (place_id);

-- ---------------------------------------------------------------------------
-- mobility_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_profiles (
  user_id                    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  weekday_radius_km          real,
  weekend_radius_km          real,
  median_trip_distance_km    real,
  max_typical_distance_km    real,
  preferred_activity_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_days                jsonb NOT NULL DEFAULT '[]'::jsonb,
  dominant_transport_mode    public.discovery_transport_mode NOT NULL DEFAULT 'unknown',
  calculated_at              timestamptz NOT NULL DEFAULT now(),
  confidence                 real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  model_version              text NOT NULL DEFAULT '1.0'
);

-- ---------------------------------------------------------------------------
-- discovery_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_profiles (
  user_id                uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  category_affinities    jsonb NOT NULL DEFAULT '{}'::jsonb,
  subcategory_affinities jsonb NOT NULL DEFAULT '{}'::jsonb,
  tag_affinities         jsonb NOT NULL DEFAULT '{}'::jsonb,
  novelty_preference     real NOT NULL DEFAULT 0.5 CHECK (novelty_preference BETWEEN 0 AND 1),
  typical_weekday_hours  jsonb NOT NULL DEFAULT '[]'::jsonb,
  typical_weekend_hours  jsonb NOT NULL DEFAULT '[]'::jsonb,
  exploration_score      real CHECK (exploration_score IS NULL OR exploration_score BETWEEN 0 AND 1),
  autopilot_score        real CHECK (autopilot_score IS NULL OR autopilot_score BETWEEN 0 AND 1),
  calculated_at          timestamptz NOT NULL DEFAULT now(),
  model_version          text NOT NULL DEFAULT '1.0'
);

COMMENT ON COLUMN public.discovery_profiles.category_affinities IS
  'JSONB map keyed by event_category.id (UUID text), not slug.';

-- ---------------------------------------------------------------------------
-- discovery_insights
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_insights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type        public.discovery_insight_type NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  score       real NOT NULL DEFAULT 0 CHECK (score >= 0),
  confidence  real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  seen_at     timestamptz,
  CONSTRAINT discovery_insights_valid_window CHECK (valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_discovery_insights_user_active
  ON public.discovery_insights (user_id, valid_until DESC)
  WHERE seen_at IS NULL;

-- ---------------------------------------------------------------------------
-- event_recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_recommendations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  recommendation_type public.recommendation_type NOT NULL,
  score               real NOT NULL CHECK (score >= 0),
  reason_codes        text[] NOT NULL DEFAULT '{}',
  context             jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz NOT NULL,
  displayed_at        timestamptz,
  opened_at           timestamptz,
  dismissed_at        timestamptz,
  route_requested_at  timestamptz,
  probable_visit_at   timestamptz,
  confirmed_checkin_at timestamptz,
  CONSTRAINT event_recommendations_valid_window CHECK (valid_until > generated_at)
);

CREATE INDEX IF NOT EXISTS idx_event_recommendations_user_type_valid
  ON public.event_recommendations (user_id, recommendation_type, valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_event_recommendations_event_id
  ON public.event_recommendations (event_id);

-- Deferred FK: discovery_visits.recommendation_id
ALTER TABLE public.discovery_visits
  DROP CONSTRAINT IF EXISTS discovery_visits_recommendation_id_fkey;

ALTER TABLE public.discovery_visits
  ADD CONSTRAINT discovery_visits_recommendation_id_fkey
  FOREIGN KEY (recommendation_id)
  REFERENCES public.event_recommendations (id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- recommendation_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendation_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.event_recommendations (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type        public.recommendation_event_type NOT NULL,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_recommendation
  ON public.recommendation_events (recommendation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_type
  ON public.recommendation_events (user_id, event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- discovery_daily_summaries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_daily_summaries (
  user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date               date NOT NULL,
  places_count       integer NOT NULL DEFAULT 0,
  new_places_count   integer NOT NULL DEFAULT 0,
  distance_km        real NOT NULL DEFAULT 0,
  radius_km          real,
  moving_minutes     integer NOT NULL DEFAULT 0,
  stationary_minutes integer NOT NULL DEFAULT 0,
  variety_score      real CHECK (variety_score IS NULL OR variety_score BETWEEN 0 AND 1),
  autopilot_score    real CHECK (autopilot_score IS NULL OR autopilot_score BETWEEN 0 AND 1),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- ---------------------------------------------------------------------------
-- discovery_location_batches (short-lived upload buffer, TTL purge via cron)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_location_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_discovery_location_batches_expires
  ON public.discovery_location_batches (expires_at)
  WHERE processed_at IS NULL;

COMMIT;
