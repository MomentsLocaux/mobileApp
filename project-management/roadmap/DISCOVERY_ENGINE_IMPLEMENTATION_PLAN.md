# Discovery Engine — Plan d'implémentation technique

**Version:** 1.1  
**Statut:** Spécification technique (repo + base live validée)  
**Date:** 2026-07-10  
**Produit:** Moments Locaux  
**Périmètre:** Post-MVP (après release store ADR 002)

Documents liés :

- Spec fonctionnelle Discovery Engine v1.0 (input produit)
- `ADR_003_DISCOVERY_ENGINE_DOMAIN.md`
- `DISCOVERY_ENGINE_TICKETS.md`

---

## 1. État des lieux du repo

### 1.1 Ce qui existe déjà et sera réutilisé

| Capacité | État actuel | Fichiers / tables |
|----------|-------------|-------------------|
| Événements géolocalisés | `events.latitude/longitude` + `location GEOGRAPHY` | `supabase/migrations/archive/202511272300_postgis_location_geography.sql` |
| Check-ins géo-validés | Edge Function 500 m | `supabase/functions/event-checkin/`, `event_checkins` |
| Signaux d'affinité | likes, interests, favorites | RPC `toggle_*`, tables dédiées |
| Vues événements | Insert client, agrégat RPC | `event_views`, `get_event_views_counts` |
| Home location (notifications classiques) | RPC `set_home_location` | `user_preferences.home_location` |
| Push delivery | triggers + `push-dispatch` | `20260608_notifications_*` |
| Engagement stats (dormant) | `event_engagement_stats` | archive migration, **non utilisé en discovery** |
| Localisation mobile | Foreground uniquement | `src/hooks/useLocation.ts`, `expo-location` |
| Offres Premium | Stub local | `src/store/offersStore.ts` — **à remplacer** |

### 1.2 Lacunes critiques vs spec Discovery

| Lacune | Impact |
|--------|--------|
| Pas de domaine `discovery_*` | Impossible de stocker lieux, visites, recommandations |
| Pas de background location | Pas de collecte passive MVP |
| Pas de `user_subscriptions` | Pas de Premium server-side |
| Pas de scoring / ranking serveur | For You et Right Now impossibles |
| `activity_log` sans policies client + CHECK rigide | Actions discovery impossibles sans migration |
| `database.ts` incomplet | `notifications`, `user_preferences`, `event_views` absents des types |
| Aucune table `discovery_*` en prod | Domaine entier à créer |
| Aucune table `user_subscriptions` en prod | Premium à créer |

### 1.3 Audit base de données live (projet `prymkgkafaovhzopslea`, 2026-07-10)

Inspection directe via Supabase MCP. Chiffres utiles pour calibrer le scoring V1.

#### Extensions et infra

| Extension | Schéma | Usage Discovery |
|-----------|--------|-----------------|
| `postgis` 3.3.7 | `extensions` | Prêt — `events.location`, `event_checkins.location`, `user_preferences.home_location` |
| `pg_cron` 1.6.4 | `pg_catalog` | Jobs profils / insights / purge |
| `pg_net` 0.19.5 | `public` | Pattern push-dispatch existant |

Indexes GiST confirmés : `idx_events_location`, `idx_event_checkins_location`, `idx_user_preferences_home_location`.

#### Volumes de données (état actuel)

| Table | Lignes | Note Discovery |
|-------|--------|----------------|
| `events` (published) | 623 | Catalogue suffisant pour scoring |
| `event_views` | 341 | Signal faible exploitable |
| `event_likes` | 454 | Signal moyen |
| `event_interests` | 280 | Signal moyen-fort |
| `favorites` | 16 | Faible volume |
| `event_checkins` | 4 | Signal fort mais quasi vide |
| `event_engagement_stats` | 228 | Agrégats prêts, non branchés au ranking |
| `profiles` | 72 | Base utilisateurs test |
| `user_preferences` | 2 | Très peu peuplé |
| `user_preferences.home_location` non null | 2 | Cold start géo important |
| `activity_log` | 0 | Table existe, jamais alimentée côté mobile |
| `device_push_tokens` | 0 | Push infra prête, pas de tokens actifs |

#### Tables discovery : absentes

Aucune table `discovery_*`, ni `user_subscriptions`, ni `event_recommendations` en production.

#### Écarts schéma importants vs spec initiale

1. **`events.category` est un UUID** (FK → `event_category.id`), pas un texte.  
   - 595/623 événements publiés ont `category` UUID.  
   - 28 événements n'ont que `category_old` (texte legacy).  
   - Les affinités JSONB doivent utiliser **UUID catégorie** comme clé, avec résolution `slug` côté app pour l'affichage.

2. **Taxonomie normalisée** : `event_category` (10 catégories), `event_subcategory`, `event_tag` existent.  
   - `events.tags` reste un `text[]` libre — les tag affinities viennent de ce tableau, pas de `event_tag`.

3. **`activity_log` existe** avec CHECK rigide :
   ```text
   action IN ('like', 'view_event', 'follow', 'mission_completed', 'purchase', 'search')
   ```
   - RLS activé, **0 policy** → deny-by-default pour les clients.  
   - Pour les actions discovery (spec §18), il faudra **étendre le CHECK** (ou le remplacer par une table de référence) + ajouter une policy INSERT owner + RPC.  
   - Le funnel discovery principal reste dans `recommendation_events` (plus adapté).

4. **FK `user_id`** : la majorité des tables pointent `profiles.id` ; `device_push_tokens` pointe `auth.users.id`.  
   - Recommandation : tables `discovery_*` → `auth.users(id)` (aligné consent/subscriptions) ; acceptable car `profiles.id = auth.users.id`.

5. **`event_checkins`** : unique `(event_id, user_id)`, source default `'web'`, colonne `location geography` peuplée, insert **uniquement via Edge Function** (pas de policy INSERT client).

6. **RPCs géo existantes** : `set_home_location`, `clear_home_location`, `process_account_deletion`. Aucune RPC discovery/recommendation.

7. **Edge Functions déployées** : `event-checkin` (v6), `delete-account` (v3), `push-dispatch` (v1), + legacy `make-server-b32ec4be`.

8. **`notification_type_mod_enum`** inclut déjà `event_nearby_new` et `followed_creator_published`. Les types discovery (§12 spec) restent à ajouter.

#### Impact sur le plan

| Zone | Ajustement |
|------|------------|
| Scoring affinité | Clés UUID `event_category.id`, fallback `category_old` pour 28 events |
| Cold start | Prioriser signaux explicites (likes/interests) + géo courante ; checkins trop rares |
| `activity_log` | Migration CHECK + policy, pas création from scratch |
| Jobs profils | Exploiter aussi `event_engagement_stats` comme signal catalogue global |
| Tests scoring | Seed avec les 10 catégories réelles (`arts-culture`, `marches-artisanat`, …) |

### 1.4 Principe architectural (non négociable)

> **Ne pas greffer le Discovery dans `profiles` ou `user_preferences` au-delà des toggles de notification.**

Le domaine Discovery est autonome, relié par `user_id` aux tables existantes.

```
profiles ─────────────┐
user_preferences ─────┼──► discovery_consents
event_checkins ───────┤         │
favorites/likes/... ──┤         ▼
events ───────────────┴──► discovery_profiles ──► event_recommendations
                              mobility_profiles         │
                              discovery_places          ▼
                              discovery_visits    recommendation_events
```

---

## 2. Schéma SQL complet (nouvelles tables)

Migration proposée : `supabase/migrations/20260710_discovery_domain_schema.sql`

> **Règle projet : ne pas appliquer sans validation humaine.**

```sql
-- ============================================================================
-- DISCOVERY ENGINE — Domain schema (additive, idempotent where possible)
-- Requires: PostGIS (already enabled via 20260610_enable_postgis_for_home_location)
-- ============================================================================

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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.discovery_visit_source AS ENUM (
    'passive',
    'checkin',
    'inferred'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
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
EXCEPTION WHEN duplicate_object THEN NULL;
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
EXCEPTION WHEN duplicate_object THEN NULL;
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
EXCEPTION WHEN duplicate_object THEN NULL;
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
EXCEPTION WHEN duplicate_object THEN NULL;
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_provider AS ENUM (
    'apple',
    'google',
    'stripe',
    'revenuecat',
    'internal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 1) user_subscriptions — Premium source of truth (server writes only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider              public.subscription_provider NOT NULL,
  product_id            text NOT NULL,
  entitlement           text NOT NULL DEFAULT 'moments_locaux_plus',
  status                public.subscription_status NOT NULL DEFAULT 'expired',
  started_at            timestamptz,
  expires_at            timestamptz,
  auto_renew            boolean NOT NULL DEFAULT false,
  trial_ends_at         timestamptz,
  provider_customer_id  text,
  provider_subscription_id text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_user_entitlement_key
    UNIQUE (user_id, entitlement)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON public.user_subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at
  ON public.user_subscriptions (expires_at)
  WHERE status IN ('active', 'grace_period', 'trialing');

-- ---------------------------------------------------------------------------
-- 2) discovery_consents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_consents (
  user_id                   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  enabled                   boolean NOT NULL DEFAULT false,
  location_enabled          boolean NOT NULL DEFAULT false,
  motion_enabled            boolean NOT NULL DEFAULT false,
  personalization_enabled   boolean NOT NULL DEFAULT false,
  consent_version           text NOT NULL DEFAULT '1.0',
  granted_at                timestamptz,
  revoked_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_consents_version_check
    CHECK (consent_version ~ '^[0-9]+\.[0-9]+$')
);

-- ---------------------------------------------------------------------------
-- 3) discovery_places
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_places (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  location                geography(Point, 4326) NOT NULL,
  centroid_latitude       double precision NOT NULL,
  centroid_longitude      double precision NOT NULL,
  radius_meters           integer NOT NULL DEFAULT 120
    CHECK (radius_meters BETWEEN 30 AND 2000),
  place_type              public.discovery_place_type NOT NULL DEFAULT 'occasional',
  confidence              real NOT NULL DEFAULT 0.5
    CHECK (confidence BETWEEN 0 AND 1),
  label                   text,  -- e.g. "Lieu habituel n°4" — never assert "domicile"
  first_seen_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  visit_count             integer NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  total_duration_minutes  integer NOT NULL DEFAULT 0 CHECK (total_duration_minutes >= 0),
  is_new                  boolean NOT NULL DEFAULT true,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_places_user_id
  ON public.discovery_places (user_id);

CREATE INDEX IF NOT EXISTS idx_discovery_places_user_last_seen
  ON public.discovery_places (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_places_location
  ON public.discovery_places USING gist (location);

-- ---------------------------------------------------------------------------
-- 4) discovery_visits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_visits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  place_id              uuid REFERENCES public.discovery_places (id) ON DELETE SET NULL,
  client_visit_id       text,  -- idempotency from mobile batch
  arrived_at            timestamptz NOT NULL,
  departed_at           timestamptz,
  duration_minutes      integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  transport_mode        public.discovery_transport_mode NOT NULL DEFAULT 'unknown',
  confidence            real NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  probable_event_id     uuid REFERENCES public.events (id) ON DELETE SET NULL,
  recommendation_id     uuid,  -- FK added after event_recommendations exists
  source                public.discovery_visit_source NOT NULL DEFAULT 'passive',
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
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
-- 5) mobility_profiles (1 row per user, recalculated)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobility_profiles (
  user_id                     uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  weekday_radius_km           real,
  weekend_radius_km           real,
  median_trip_distance_km     real,
  max_typical_distance_km     real,
  preferred_activity_windows  jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_days                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  dominant_transport_mode     public.discovery_transport_mode NOT NULL DEFAULT 'unknown',
  calculated_at               timestamptz NOT NULL DEFAULT now(),
  confidence                  real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  model_version               text NOT NULL DEFAULT '1.0'
);

-- ---------------------------------------------------------------------------
-- 6) discovery_profiles (1 row per user, recalculated)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_profiles (
  user_id                   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  category_affinities       jsonb NOT NULL DEFAULT '{}'::jsonb,
  subcategory_affinities    jsonb NOT NULL DEFAULT '{}'::jsonb,
  tag_affinities            jsonb NOT NULL DEFAULT '{}'::jsonb,
  novelty_preference        real NOT NULL DEFAULT 0.5 CHECK (novelty_preference BETWEEN 0 AND 1),
  typical_weekday_hours     jsonb NOT NULL DEFAULT '[]'::jsonb,
  typical_weekend_hours     jsonb NOT NULL DEFAULT '[]'::jsonb,
  exploration_score         real CHECK (exploration_score IS NULL OR exploration_score BETWEEN 0 AND 1),
  autopilot_score           real CHECK (autopilot_score IS NULL OR autopilot_score BETWEEN 0 AND 1),
  calculated_at             timestamptz NOT NULL DEFAULT now(),
  model_version             text NOT NULL DEFAULT '1.0'
);

-- ---------------------------------------------------------------------------
-- 7) discovery_insights
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type          public.discovery_insight_type NOT NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  score         real NOT NULL DEFAULT 0 CHECK (score >= 0),
  confidence    real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  valid_from    timestamptz NOT NULL DEFAULT now(),
  valid_until   timestamptz NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  seen_at       timestamptz,
  CONSTRAINT discovery_insights_valid_window
    CHECK (valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_discovery_insights_user_active
  ON public.discovery_insights (user_id, valid_until DESC)
  WHERE seen_at IS NULL;

-- ---------------------------------------------------------------------------
-- 8) event_recommendations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_recommendations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  recommendation_type   public.recommendation_type NOT NULL,
  score                 real NOT NULL CHECK (score >= 0),
  reason_codes          text[] NOT NULL DEFAULT '{}',
  context               jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  valid_until           timestamptz NOT NULL,
  displayed_at          timestamptz,
  opened_at             timestamptz,
  dismissed_at          timestamptz,
  route_requested_at    timestamptz,
  probable_visit_at     timestamptz,
  confirmed_checkin_at  timestamptz,
  CONSTRAINT event_recommendations_valid_window
    CHECK (valid_until > generated_at)
);

CREATE INDEX IF NOT EXISTS idx_event_recommendations_user_type_valid
  ON public.event_recommendations (user_id, recommendation_type, valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_event_recommendations_event_id
  ON public.event_recommendations (event_id);

-- Deferred FK from discovery_visits
ALTER TABLE public.discovery_visits
  DROP CONSTRAINT IF EXISTS discovery_visits_recommendation_id_fkey;

ALTER TABLE public.discovery_visits
  ADD CONSTRAINT discovery_visits_recommendation_id_fkey
  FOREIGN KEY (recommendation_id)
  REFERENCES public.event_recommendations (id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 9) recommendation_events (funnel audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendation_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   uuid NOT NULL REFERENCES public.event_recommendations (id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_type          public.recommendation_event_type NOT NULL,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_recommendation
  ON public.recommendation_events (recommendation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_type
  ON public.recommendation_events (user_id, event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- 10) discovery_daily_summaries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_daily_summaries (
  user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date                date NOT NULL,
  places_count        integer NOT NULL DEFAULT 0,
  new_places_count    integer NOT NULL DEFAULT 0,
  distance_km         real NOT NULL DEFAULT 0,
  radius_km           real,
  moving_minutes      integer NOT NULL DEFAULT 0,
  stationary_minutes  integer NOT NULL DEFAULT 0,
  variety_score       real CHECK (variety_score IS NULL OR variety_score BETWEEN 0 AND 1),
  autopilot_score     real CHECK (autopilot_score IS NULL OR autopilot_score BETWEEN 0 AND 1),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- ---------------------------------------------------------------------------
-- 11) discovery_location_batches (short-lived raw upload buffer — optional MVP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_location_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  payload       jsonb NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_discovery_location_batches_expires
  ON public.discovery_location_batches (expires_at)
  WHERE processed_at IS NULL;

COMMIT;
```

### 2.1 Extension `user_preferences` (seule modification table existante)

```sql
-- supabase/migrations/20260712_discovery_notification_prefs.sql
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS discovery_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS right_now_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS break_loop_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS life_insight_push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_max_push_per_week smallint NOT NULL DEFAULT 3
    CHECK (discovery_max_push_per_week BETWEEN 0 AND 14);

COMMENT ON COLUMN public.user_preferences.discovery_push_enabled IS
  'Master toggle for Discovery notification families (distinct from notify_event_nearby).';
```

### 2.2 Distinction `home_location` vs `discovery_places`

| Concept | Table | Usage |
|---------|-------|-------|
| `home_location` | `user_preferences` | Notifications classiques « nouvel événement près de chez vous » (déclaré/snapshoté) |
| `probable_home` | `discovery_places` | Inférence comportementale — **jamais affiché comme vérité** |

Ne pas fusionner ces concepts en V1.

---

## 3. RLS et sécurité

Migration proposée : `supabase/migrations/20260711_discovery_domain_rls.sql`

### 3.1 Matrice des droits

| Table | SELECT (authenticated) | INSERT/UPDATE (authenticated) | INSERT/UPDATE (service_role) |
|-------|------------------------|-------------------------------|------------------------------|
| `user_subscriptions` | own row, colonnes résumé | **deny** | webhook provider |
| `discovery_consents` | own | own (grant/revoke flags) | sync si besoin |
| `discovery_places` | own | **deny** | via `discovery-ingest` |
| `discovery_visits` | own | **deny** | via `discovery-ingest` |
| `mobility_profiles` | own | **deny** | cron job |
| `discovery_profiles` | own | **deny** | cron job |
| `discovery_insights` | own | update `seen_at` only | cron job |
| `event_recommendations` | own | update reaction timestamps via RPC | `discovery-score` |
| `recommendation_events` | own | via RPC `track_recommendation_event` | service |
| `discovery_daily_summaries` | own | **deny** | cron job |

### 3.2 Policies exemplaires

```sql
-- discovery_consents: owner manages consent
CREATE POLICY discovery_consents_select_own ON public.discovery_consents
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY discovery_consents_upsert_own ON public.discovery_consents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY discovery_consents_update_own ON public.discovery_consents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- discovery_places: read-only for client
CREATE POLICY discovery_places_select_own ON public.discovery_places
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- event_recommendations: read own; reactions via SECURITY DEFINER RPC only
CREATE POLICY event_recommendations_select_own ON public.event_recommendations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- user_subscriptions: read own summary
CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### 3.3 RPCs SECURITY DEFINER recommandées

| RPC | Rôle |
|-----|------|
| `get_user_entitlement(p_entitlement text)` | Retourne `is_premium`, `status`, `expires_at` |
| `upsert_discovery_consent(...)` | Active/révoque avec horodatage |
| `track_recommendation_event(p_recommendation_id, p_event_type, p_metadata)` | Écrit funnel + met à jour timestamps |
| `purge_discovery_data(p_user_id)` | Efface tout le domaine (GDPR) |
| `get_right_now_recommendations(p_limit int)` | Retourne candidats valides pour l'utilisateur courant |

### 3.4 Extension `process_account_deletion`

Ajouter dans la RPC existante (`20260604_fix_account_deletion_profile_anonymisation.sql`) :

```sql
DELETE FROM public.recommendation_events WHERE user_id = v_user_id;
DELETE FROM public.event_recommendations WHERE user_id = v_user_id;
DELETE FROM public.discovery_insights WHERE user_id = v_user_id;
DELETE FROM public.discovery_daily_summaries WHERE user_id = v_user_id;
DELETE FROM public.discovery_visits WHERE user_id = v_user_id;
DELETE FROM public.discovery_places WHERE user_id = v_user_id;
DELETE FROM public.mobility_profiles WHERE user_id = v_user_id;
DELETE FROM public.discovery_profiles WHERE user_id = v_user_id;
DELETE FROM public.discovery_consents WHERE user_id = v_user_id;
DELETE FROM public.discovery_location_batches WHERE user_id = v_user_id;
DELETE FROM public.user_subscriptions WHERE user_id = v_user_id;
```

### 3.5 GDPR / minimisation

- Pas de conservation illimitée des batches bruts : cron `DELETE FROM discovery_location_batches WHERE expires_at < now()`.
- Les libellés de lieux restent génériques (« Lieu habituel n°N »).
- Export données : étendre plus tard une RPC `export_discovery_data` (P2 compliance).

---

## 4. Edge Functions et jobs serveur

### 4.1 `discovery-ingest` (P0)

**Chemin :** `supabase/functions/discovery-ingest/index.ts`

**Contrat POST (authentifié) :**

```typescript
type DiscoveryIngestPayload = {
  consentVersion: string;
  visits: Array<{
    clientVisitId: string;
    arrivedAt: string;       // ISO
    departedAt?: string;
    latitude: number;
    longitude: number;
    durationMinutes?: number;
    transportMode?: 'walking' | 'driving' | 'stationary' | 'unknown';
    confidence?: number;
  }>;
};
```

**Pipeline :**

1. Valider JWT + profil actif (pattern `event-checkin`).
2. Lire `discovery_consents` : refuser 403 si `enabled = false` ou `location_enabled = false`.
3. Pour chaque visite : idempotence `(user_id, client_visit_id)`.
4. Clustering lieu V1 : si point dans `radius_meters` d'un `discovery_places` existant → rattacher ; sinon créer `discovered`.
5. Insérer `discovery_visits`, mettre à jour agrégats place.
6. Ne pas persister le payload brut au-delà de 7 jours si table batches utilisée.

### 4.2 `discovery-score` (P0)

**Chemin :** `supabase/functions/discovery-score/index.ts`

**Déclenchement :**

- On-demand : appel mobile à l'ouverture Discovery Home.
- Cron : toutes les 2 h pour utilisateurs actifs avec consentement.

**Entrées :**

- Position courante (query param ou body, optionnel).
- `discovery_profiles`, `mobility_profiles`, `discovery_places`.
- Événements `published` avec `starts_at` dans fenêtre `[now, now + 48h]`.
- Signaux engagement : `favorites`, `event_likes`, `event_interests`, `event_checkins`.

**Sortie :**

- Upsert `event_recommendations` avec `valid_until`.
- Insert `recommendation_events` type `generated`.

### 4.3 `subscription-webhook` (P0)

**Chemin :** `supabase/functions/subscription-webhook/index.ts`

Reçoit événements RevenueCat / App Store Server Notifications / Play Billing.

Met à jour `user_subscriptions` en `service_role`.

Le mobile appelle uniquement `get_user_entitlement`.

### 4.4 Jobs pg_cron (P0/P1)

| Job | Fréquence | Action |
|-----|-----------|--------|
| `discovery_recalculate_profiles` | quotidien 03:00 UTC | `mobility_profiles`, `discovery_profiles`, `discovery_daily_summaries` |
| `discovery_match_outcomes` | toutes les 6 h | corréler visites ↔ recommandations (P1) |
| `discovery_generate_insights` | quotidien | peupler `discovery_insights` (P1) |
| `discovery_purge_raw_batches` | quotidien | TTL batches |
| `discovery_push_opportunities` | toutes les 30 min | notifications Right Now (P1) |

Pattern existant à suivre : `20260608_notifications_event_soon_cron.sql`.

---

## 5. Moteur de scoring V1

### 5.1 Formule

Pour chaque couple `(user, event)` candidat :

```
score = w_content   * affinity_score
      + w_geo       * geo_score
      + w_time      * time_score
      + w_mobility  * mobility_score
      + w_novelty   * novelty_score
      + w_context   * context_score
```

**Pondérations V1 (configurables en constantes Edge Function) :**

| Composante | Poids | Calcul V1 |
|------------|-------|-----------|
| `affinity_score` | 0.25 | Max des affinités catégorie/sous-catégorie/tags depuis `discovery_profiles` + boosts likes/favorites/checkins |
| `geo_score` | 0.20 | `1 - min(1, distance_km / max_acceptable_km)` où `max_acceptable_km` vient de `mobility_profiles.max_typical_distance_km` ou fallback 25 |
| `time_score` | 0.15 | Proximité `starts_at` vs fenêtres `typical_weekday_hours` / `typical_weekend_hours` |
| `mobility_score` | 0.15 | Adéquation distance au jour (weekday vs weekend radius) |
| `novelty_score` | 0.15 | Bonus si zone peu visitée (aucun place dans 2 km) ; malus si lieu saturé |
| `context_score` | 0.10 | Right Now : temps avant début ; hors lieu habituel : bonus |

### 5.2 Reason codes (pour Why This P1)

| Code | Signification |
|------|---------------|
| `nearby` | < 20 min trajet estimé |
| `category_match` | Catégorie dans top affinités |
| `time_match` | Créneau habituel |
| `new_area` | Zone peu explorée |
| `weekend_fit` | Compatible rayon week-end |
| `starting_soon` | Commence dans < 90 min |
| `past_interest` | Like/favorite antérieur même créateur ou catégorie |

### 5.3 Règles éligibilité

- `events.status = 'published'`
- `events.visibility = 'public'` (sauf invité privé)
- `starts_at > now()` pour Right Now
- Non déjà dismissé dans les 48 h
- Score minimum 0.35 pour affichage
- Free : max 1 Right Now / jour, For You = tri léger top 10 sans explications
- Premium : flux complet, 3 Break the Loop, My Radius détaillé

### 5.4 Pseudo-code TypeScript (extrait)

```typescript
const WEIGHTS = {
  content: 0.25,
  geo: 0.20,
  time: 0.15,
  mobility: 0.15,
  novelty: 0.15,
  context: 0.10,
} as const;

function scoreCandidate(ctx: ScoringContext, event: EventRow): ScoredCandidate {
  const distanceKm = haversineKm(ctx.userLat, ctx.userLon, event.latitude, event.longitude);
  const maxKm = ctx.mobility.maxTypicalDistanceKm ?? 25;

  const affinity = affinityForEvent(ctx.profile, event);
  const geo = 1 - Math.min(1, distanceKm / maxKm);
  const time = timeFit(ctx.profile, event.starts_at);
  const mobility = mobilityFit(ctx.mobility, distanceKm, ctx.isWeekend);
  const novelty = noveltyForLocation(ctx.places, event.latitude, event.longitude);
  const context = contextBoost(ctx, event);

  const score =
    WEIGHTS.content * affinity +
    WEIGHTS.geo * geo +
    WEIGHTS.time * time +
    WEIGHTS.mobility * mobility +
    WEIGHTS.novelty * novelty +
    WEIGHTS.context * context;

  return { eventId: event.id, score, reasonCodes: buildReasonCodes({ affinity, geo, time, novelty, context }) };
}
```

### 5.5 Exploitation des signaux existants (affinité)

| Signal | Poids relatif dans `affinity_score` |
|--------|-------------------------------------|
| `event_checkins` | 1.0 |
| `event_interests` | 0.7 |
| `favorites` | 0.6 |
| `event_likes` | 0.4 |
| `event_views` (7 jours) | 0.15 |
| Recommandation → visite probable | 1.2 (P1) |

Requête SQL d'amorçage (job profils) :

```sql
-- Affinity backfill: keys are event_category UUIDs (live schema).
-- Fallback: map category_old slug via event_category.slug when e.category IS NULL.
WITH signals AS (
  SELECT coalesce(e.category::text, ec.id::text) AS cat_key, 1.0 AS w
  FROM event_checkins c
  JOIN events e ON e.id = c.event_id
  LEFT JOIN event_category ec ON ec.slug = e.category_old
  WHERE c.user_id = p_user_id AND coalesce(e.category, ec.id) IS NOT NULL
  UNION ALL
  SELECT coalesce(e.category::text, ec.id::text), 0.7
  FROM event_interests i
  JOIN events e ON e.id = i.event_id
  LEFT JOIN event_category ec ON ec.slug = e.category_old
  WHERE i.user_id = p_user_id AND coalesce(e.category, ec.id) IS NOT NULL
  UNION ALL
  SELECT coalesce(e.category::text, ec.id::text), 0.6
  FROM favorites f
  JOIN events e ON e.id = f.event_id
  LEFT JOIN event_category ec ON ec.slug = e.category_old
  WHERE f.profile_id = p_user_id AND coalesce(e.category, ec.id) IS NOT NULL
  UNION ALL
  SELECT coalesce(e.category::text, ec.id::text), 0.4
  FROM event_likes l
  JOIN events e ON e.id = l.event_id
  LEFT JOIN event_category ec ON ec.slug = e.category_old
  WHERE l.user_id = p_user_id AND coalesce(e.category, ec.id) IS NOT NULL
)
SELECT cat_key, LEAST(1.0, SUM(w) / 3.0) AS affinity
FROM signals
GROUP BY cat_key;
-- Résultat stocké dans discovery_profiles.category_affinities jsonb, ex:
-- {"eea48b87-8009-4978-b9d1-ac3861920e7d": 0.72, "2d87b01f-800b-44ba-814d-3bbf815a7642": 0.45}
```

---

## 6. Architecture mobile — collecte passive

### 6.1 Structure de modules proposée

```
src/
  services/
    discovery/
      discovery-consent.service.ts    # CRUD consent + feature flag
      discovery-capture.service.ts    # on-device stop detection
      discovery-sync.service.ts       # batch upload → discovery-ingest
      discovery-recommendations.service.ts
      discovery-places.service.ts     # read-only fetch
    subscription.service.ts           # entitlement RPC
  hooks/
    useDiscoveryConsent.ts
    useDiscoveryCapture.ts
    usePremiumEntitlement.ts
    useRightNow.ts
  tasks/
    discovery-location.task.ts        # expo-task-manager background task
app/
  discovery/
    index.tsx                         # Discovery Home
    my-radius.tsx                     # P1
    break-the-loop.tsx                # P1
  onboarding/
    discovery.tsx                     # 3-screen consent flow
  settings/
    discovery.tsx                     # toggles + purge
```

### 6.2 Pipeline on-device (minimisation)

```
GPS samples (buffer 24h local max)
    ↓
Motion classification (speed threshold)
    ↓
Stop detection (≥ 12 min, rayon 120 m)
    ↓
Visit object { arrivedAt, departedAt, centroid, duration, mode }
    ↓
Batch sync (Wi-Fi or foreground, max 1/15 min)
    ↓
discovery-ingest Edge Function
```

**Seuils V1 recommandés :**

| Paramètre | Valeur |
|-----------|--------|
| Min stop duration | 12 min |
| Cluster radius | 120 m |
| Sample interval (background) | 5 min (balanced) |
| Max batch size | 20 visites |
| Local buffer TTL | 24 h puis purge |

### 6.3 Dépendances à ajouter

```json
{
  "expo-task-manager": "~13.x",
  "expo-background-fetch": "~13.x"
}
```

### 6.4 Permissions (`app.config.ts`)

```typescript
ios: {
  infoPlist: {
    NSLocationWhenInUseUsageDescription: '...',
    NSLocationAlwaysAndWhenInUseUsageDescription: '...',
    UIBackgroundModes: ['location'],
  },
},
android: {
  permissions: [
    'ACCESS_COARSE_LOCATION',
    'ACCESS_FINE_LOCATION',
    'ACCESS_BACKGROUND_LOCATION', // après justification UX
  ],
},
plugins: [
  [
    'expo-location',
    {
      locationAlwaysAndWhenInUsePermission:
        'Moments Locaux utilise votre position pour vous proposer des découvertes accessibles, même lorsque l\'app est en arrière-plan. Vous pouvez désactiver cette fonction à tout moment.',
      isAndroidBackgroundLocationEnabled: true,
      isIosBackgroundLocationEnabled: true,
    },
  ],
],
```

### 6.5 Feature flag

```env
EXPO_PUBLIC_DISCOVERY_ENABLED=false
EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED=false
```

Tant que `false` : routes `/discovery/*` redirigent (même pattern que shop/missions).

### 6.6 Relation avec `useLocation` existant

| Hook / service | Rôle |
|----------------|------|
| `useLocation` | UX carte, check-in, Right Now immédiat (foreground) |
| `useDiscoveryCapture` | Collecte passive, indépendante, consent-gated |

Ne pas mélanger les stores : `locationStore` reste pour l'UI ; `discoveryCaptureStore` pour le buffer offline.

---

## 7. Surfaces UI et parcours

### 7.1 MVP (P0)

| Écran | Route | Accès |
|-------|-------|-------|
| Onboarding Discovery | `/onboarding/discovery` | Tous (opt-in) |
| Discovery Home | `/discovery` | Consent requis |
| Right Now card | composant dans Home + Discovery | Free limité / Premium complet |
| For You section | `/discovery` ou onglet dédié post-beta | Free basique |
| My Radius teaser | `/discovery` | Free aperçu chiffré |
| Discovery Settings | `/settings/discovery` | Tous |
| Premium Paywall | sheet modal | Après aperçu valeur |
| Subscription | `/profile/subscription` | Tous |

### 7.2 Entrée navigation

Ajouter entrée drawer / profil **derrière** `EXPO_PUBLIC_DISCOVERY_ENABLED`.

Ne pas remplacer l'onglet Carte existant — Discovery est un mode complémentaire.

---

## 8. Notifications Discovery (P1)

### 8.1 Nouveaux types enum

```sql
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_right_now';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_break_loop';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_new_area';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_personal_match';
ALTER TYPE public.notification_type_mod_enum ADD VALUE IF NOT EXISTS 'discovery_life_insight';
```

### 8.2 Garde-fous anti-spam

```typescript
const canSendDiscoveryPush = (prefs, history) =>
  prefs.discovery_push_enabled &&
  prefs.push_enabled &&
  history.last7DaysCount < prefs.discovery_max_push_per_week &&
  !history.inCooldown &&
  !isQuietHours(now, prefs);
```

Extension `push-dispatch` : vérifier colonnes discovery avant envoi (comme `push_enabled` actuel).

---

## 9. Intégration Premium

### 9.1 Modèle

| Plan | Entitlement | Prix cible |
|------|-------------|------------|
| Mensuel | `moments_locaux_plus` | 2,99 € |
| Annuel | `moments_locaux_plus_annual` | 19,99 € |

### 9.2 Contrôle d'accès

```typescript
// src/hooks/usePremiumEntitlement.ts
const { isPremium } = usePremiumEntitlement('moments_locaux_plus');

// Backend
SELECT public.get_user_entitlement('moments_locaux_plus');
-- returns { is_active: boolean, status, expires_at }
```

### 9.3 Migration depuis `offersStore`

1. `usePremiumEntitlement` lit RPC.
2. `offersStore` reste fallback dev-only derrière `__DEV__`.
3. Suppression du stub en P1 une fois IAP branché.

---

## 10. Découpage phases et jalons

### Phase MVP — Discovery Foundation (DISC-P0-*)

**Objectif :** boucle minimale observer → recommander → mesurer.

Livrables :

- [ ] Schéma + RLS
- [ ] Consentement onboarding
- [ ] Collecte passive basique
- [ ] Scoring Right Now + For You simple
- [ ] UI réactions
- [ ] Entitlement Premium (stub ou IAP)
- [ ] Paywall contextuel
- [ ] Jobs profils quotidiens

**Critère succès produit :** une « découverte réelle » mesurable (recommandation → visite probable ou check-in) chez bêta-testeurs consentants.

### Phase 2 — Personal Discovery (DISC-P1-*)

- Break the Loop
- My Radius complet
- Insights
- Notifications intelligentes
- Why This
- Boucle apprentissage outcome

### Phase 3 — Life Intelligence (DISC-P2-*)

- Life Replay
- Attributs événements enrichis
- Météo
- Partage social

---

## 11. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Rejet store (background location) | Onboarding clair, désactivation facile, justification « découverte accessible » |
| Cold start (nouvel utilisateur) | Fallback éditorial + signaux explicites (likes) + geo défaut 25 km |
| Coût Edge/DB | Cron batch, limiter regénération scoring, index GiST |
| Dérive schéma / types | DISC-P0-012 + génération types Supabase |
| Confusion home_location / discovery | ADR + copy UX distinct |
| Premium avant IAP réel | Feature flag + entitlement `internal` pour bêta |
| Batterie | intervalles conservateurs, arrêt si révocation |

---

## 12. Commandes de vérification (par lot)

```bash
# Mobile (après chaque lot code)
npm run typecheck
npm run lint

# Config (si app.config / permissions modifiés)
npx expo config

# SQL (avant apply migration)
# Revue humaine obligatoire — ne pas supabase db push sans validation

# Edge Functions
supabase functions serve discovery-ingest --env-file .env.local
supabase functions serve discovery-score --env-file .env.local
```

---

## 13. Prochaines actions immédiates

1. Valider ADR 003 et ce plan en revue produit + GDPR.
2. Créer ticket DISC-P0-001 et branche `feat/disc-p0-discovery-schema`.
3. Prototyper scoring sur jeu de données test (sans migration prod).
4. Décider provider IAP (RevenueCat recommandé pour iOS+Android unifié).
5. Rédiger copy onboarding + fiche App Store « background location ».

---

## Annexe A — Mapping spec → repo

| Spec § | Implémentation repo |
|--------|---------------------|
| §7 Objets métier | Tables §2 |
| §8 Scoring | §5 + `discovery-score` |
| §9 Signaux affinité | Job profils + tables existantes |
| §11 États recommandation | `recommendation_event_type` enum + RPC track |
| §12 Notifications | §8 + extension `push-dispatch` |
| §13 Premium | `user_subscriptions` + `get_user_entitlement` |
| §15 Écrans | §7 routes `app/discovery/*` |
| §17 Tables | §2 SQL complet |
| §18 Modifications existantes | `user_preferences` only + `activity_log` P1 |
| §20 MVP | DISC-P0 tickets |
| §21 Phase 2 | DISC-P1 tickets |
| §22 Phase 3 | DISC-P2 tickets |
