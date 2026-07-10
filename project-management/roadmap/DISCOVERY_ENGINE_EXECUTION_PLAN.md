# Discovery Engine — Plan d'exécution détaillé (module plug-in)

**Version:** 1.0  
**Date:** 2026-07-10  
**Branche de travail initiale:** `docs/discovery-engine-implementation-plan`  
**Références:** `ADR_003`, `DISCOVERY_ENGINE_IMPLEMENTATION_PLAN.md`, `DISCOVERY_ENGINE_TICKETS.md`

---

## Principe directeur

Discovery est un **module plug-in** : nouvelles tables, nouvelles routes, nouvelles Edge Functions, feature flags. L'existant (carte, liste, recherche, notifs classiques, check-in) reste inchangé quand les flags sont `false`.

```
┌─────────────────────────────────────────────────────────────┐
│  APP EXISTANTE (inchangée si flags off)                     │
│  Carte · Liste · Recherche · Détail · Check-in · Notifs    │
└─────────────────────────────────────────────────────────────┘
                              │
                    feature flags
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MODULE DISCOVERY (plug-in)                                 │
│  Consent · Score · Recommandations · Premium · Capture      │
└─────────────────────────────────────────────────────────────┘
```

---

## Vue d'ensemble des phases

| Phase | Objectif | Durée indicative | Visible utilisateur |
|-------|----------|------------------|---------------------|
| **A — Backend silencieux** | Schéma + RLS + scoring V1 | 2–3 semaines | Non (flags off) |
| **B — Foundation mobile** | Consent + Right Now + For You simple | 2–3 semaines | Oui (opt-in) |
| **C — Mobilité passive** | Capture + lieux + profils mobilité | 2 semaines | Oui (consent location) |
| **D — Premium** | Entitlement + paywall | 1–2 semaines | Oui |
| **E — Personal Discovery (P1)** | Break the Loop, My Radius, notifs, Why This | 3–4 semaines | Premium |
| **F — Life Intelligence (P2)** | Life Replay, attributs events, météo | Post-launch | Premium |

---

## Phase A — Backend silencieux (0 régression mobile)

Objectif : poser le domaine `discovery_*` et un moteur de scoring testable, **sans toucher l'app visible**.

### Lot A1 — Schéma domaine (DISC-P0-001)

**Branche:** `feat/disc-p0-discovery-schema`  
**Migration:** `supabase/migrations/20260710_discovery_domain_schema.sql`

Créer (additive only) :
- Enums : `discovery_place_type`, `recommendation_type`, `recommendation_event_type`, etc.
- Tables : `discovery_consents`, `discovery_places`, `discovery_visits`, `mobility_profiles`, `discovery_profiles`, `event_recommendations`, `recommendation_events`, `discovery_daily_summaries`, `user_subscriptions`
- Optionnel : `discovery_location_batches` (TTL 7 jours)

**Ne pas toucher :** `profiles`, `events`, tables engagement.

**Done quand :** migration revue + validée humainement ; `list_tables` MCP confirme les tables ; rollback script documenté.

### Lot A2 — RLS + RPCs (DISC-P0-002)

**Branche:** `feat/disc-p0-discovery-rls`  
**Migration:** `supabase/migrations/20260711_discovery_domain_rls.sql`

- RLS owner-read sur toutes tables discovery
- Deny client write sur `discovery_places`, `discovery_visits`, profils calculés
- RPCs `SECURITY DEFINER` :
  - `get_user_entitlement(p_entitlement text)`
  - `upsert_discovery_consent(...)`
  - `track_recommendation_event(...)`
  - `get_active_recommendations(p_type, p_limit)`
- Extension `process_account_deletion` : purge `discovery_*` + `user_subscriptions`

**Done quand :** scripts diagnostic anon/auth/owner passent ; suppression compte test efface discovery.

### Lot A3 — Prefs notif discovery (DISC-P0-003)

**Branche:** `feat/disc-p0-discovery-prefs`  
**Migration:** `20260712_discovery_notification_prefs.sql`

5 colonnes sur `user_preferences` (defaults `false` / `3` max push) :
- `discovery_push_enabled`, `right_now_push_enabled`, `break_loop_push_enabled`, `life_insight_push_enabled`, `discovery_max_push_per_week`

**Mobile :** étendre `preferences.service.ts` + types. **Pas d'UI** tant que flag off.

**Done quand :** `npm run typecheck` ; colonnes visibles en prod après apply.

### Lot A4 — Types TS (DISC-P0-012)

**Branche:** `feat/disc-p0-discovery-types`

- `src/types/discovery.types.ts`
- Extension ciblée `database.ts` ou génération Supabase
- Pas de modification `supabase-provider.ts` liste/carte

**Done quand :** typecheck vert ; aucun import discovery dans chemins carte/liste.

### Lot A5 — Scoring V1 (DISC-P0-006)

**Branche:** `feat/disc-p0-discovery-scoring`  
**Fichiers :** `supabase/functions/discovery-score/index.ts`, `20260713_discovery_scoring_rpc.sql`

**Entrées (lecture seule) :**
- `events` published, fenêtre temporelle
- `discovery_profiles` (vide au début → cold start)
- Signaux : `event_likes`, `event_interests`, `favorites`, `event_views`
- Position optionnelle (body request)
- PostGIS `ST_DWithin` sur `events.location`

**Sorties :**
- Upsert `event_recommendations` (`right_now`, `for_you`)
- Insert `recommendation_events` (`generated`)

**Cold start V1 (sans capture passive) :**
- Affinités depuis likes/interests (UUID `event_category.id`)
- Géo : position courante ou `home_location` si dispo
- Fallback rayon 25 km

**Done quand :** invocation manuelle retourne 1–5 reco pour user test ; scores persistés.

### Lot A6 — Job profils (DISC-P0-011)

**Branche:** `feat/disc-p0-discovery-profiles`  
**Migration:** `20260715_discovery_profile_jobs.sql`

Cron quotidien `discovery_recalculate_profiles` :
- Peuple `discovery_profiles.category_affinities` (clés UUID)
- Peuple `mobility_profiles` (minimal sans visites : rayon depuis checkins/home si dispo)
- `discovery_daily_summaries`

**Done quand :** job manuel sur user avec likes → affinités JSONB non vides.

### Checkpoint Phase A

- [ ] Flags mobile toujours `false`
- [ ] Carte / liste / check-in inchangés
- [ ] Scoring invocable via curl / MCP
- [ ] Aucune policy RLS modifiée sur tables engagement

---

## Phase B — Foundation mobile (opt-in, plug-in UI)

Objectif : première valeur utilisateur — **Right Now** et **For You simple** — sans capture background.

### Lot B1 — Feature flags + garde routes (prérequis)

**Fichiers :** `app.config.ts`, `src/constants/feature-flags.ts`, `app/discovery/_layout.tsx`

```typescript
export const DISCOVERY_ENABLED =
  process.env.EXPO_PUBLIC_DISCOVERY_ENABLED === 'true';
```

Routes `/discovery/*` → redirect si `!DISCOVERY_ENABLED`.

### Lot B2 — Consentement (DISC-P0-007)

**Branche:** `feat/disc-p0-discovery-consent`  
**Fichiers :**
- `app/onboarding/discovery.tsx` (3 écrans)
- `app/settings/discovery.tsx`
- `src/services/discovery/discovery-consent.service.ts`
- `src/hooks/useDiscoveryConsent.ts`

Flux :
1. Valeur → contrôle → Activer Discovery
2. RPC `upsert_discovery_consent` (pas de Premium requis)
3. Révocation → stop sync + option purge

**Ne pas demander** background location ici (Phase C).

**Done quand :** consent persisté ; révocation immédiate ; lien politique confidentialité.

### Lot B3 — Services recommandations (DISC-P0-009 partie 1)

**Branche:** `feat/disc-p0-discovery-services`  
**Fichiers :**
- `src/services/discovery/discovery-recommendations.service.ts`
- `src/hooks/useRightNow.ts`, `useForYou.ts`

Appels :
- `supabase.functions.invoke('discovery-score')` à l'ouverture Discovery Home
- `get_active_recommendations` RPC pour lire
- `track_recommendation_event` pour réactions

### Lot B4 — Discovery Home + Right Now (DISC-P0-009 partie 2)

**Branche:** `feat/disc-p0-discovery-ui`  
**Fichiers :**
- `app/discovery/index.tsx`
- `src/components/discovery/RightNowCard.tsx`
- `src/components/discovery/ForYouList.tsx`
- Entrée drawer/profil (si `DISCOVERY_ENABLED`)

**Free :** 1 Right Now / jour, For You top 10 sans explications.  
**Réactions :** Voir, Pas maintenant, Ça m'intéresse, Itinéraire → `recommendation_events`.

**Ne pas modifier :** `EventsListScreen`, `map.tsx`, `EventCard` variant discovery existant (nom seulement).

### Lot B5 — My Radius teaser (aperçu chiffré)

Section dans Discovery Home :
- « X lieux dans votre territoire » (depuis `discovery_places` ou message cold start)
- CTA Premium (sans paywall forcé)

**Done quand :** parcours complet consent → home → 1 reco → réaction tracée.

### Checkpoint Phase B

- [ ] `DISCOVERY_ENABLED=false` → zéro régression visible
- [ ] `DISCOVERY_ENABLED=true` → parcours discovery isolé
- [ ] Liste/carte toujours tri `created_at` / client sort

---

## Phase C — Mobilité passive (consent location séparé)

Objectif : enrichir profils sans casser l'existant. **Permission background = étape distincte** après consentement discovery.

### Lot C1 — discovery-ingest (DISC-P0-004)

**Branche:** `feat/disc-p0-discovery-ingest`  
**Edge Function:** `supabase/functions/discovery-ingest/index.ts`

- Vérifie `discovery_consents.location_enabled`
- Reçoit visites dérivées (pas GPS brut longue durée)
- Clustering lieu V1 (120 m)
- Idempotence `client_visit_id`

### Lot C2 — Capture on-device (DISC-P0-005)

**Branche:** `feat/disc-p0-discovery-capture`  
**Flag:** `EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED`

**Fichiers :**
- `src/tasks/discovery-location.task.ts`
- `src/services/discovery/discovery-capture.service.ts`
- `src/services/discovery/discovery-sync.service.ts`
- `src/hooks/useDiscoveryCapture.ts`

Seuils : stop ≥ 12 min, sync max 1/15 min, buffer local 24 h.

**Dépendances npm :** `expo-task-manager`

**Done quand :** visite test → ingest → `discovery_places` + `discovery_visits` ; révocation stoppe capture.

### Lot C3 — Enrichissement scoring

Mettre à jour `discovery-score` :
- `novelty_score` depuis `discovery_places`
- `mobility_score` depuis `mobility_profiles`
- Hors lieu habituel → bonus `context_score`

**Done quand :** reco différente avec vs sans visites simulées.

---

## Phase D — Premium (monétisation plug-in)

### Lot D1 — user_subscriptions + entitlement (DISC-P0-008)

**Branche:** `feat/disc-p0-premium-entitlement`

- Table déjà en A1
- `subscription-webhook` (stub RevenueCat / internal bêta)
- `src/hooks/usePremiumEntitlement.ts`
- `offersStore` : fallback `__DEV__` seulement

### Lot D2 — Paywall contextuel (DISC-P0-010)

**Branche:** `feat/disc-p0-premium-paywall`

- `PremiumPaywallSheet.tsx` après aperçu insight
- `app/profile/subscription.tsx`
- Pas de paywall à l'installation

**Gating :**
| Feature | Free | Premium |
|---------|------|---------|
| Right Now | 1/jour | Flux complet |
| For You | Top 10 basique | Classé + explications (P1) |
| Break the Loop | — | P1 |
| My Radius détail | Teaser | P1 |

**Done quand :** entitlement RPC contrôle l'UI ; client ne peut pas s'auto-attribuer Premium.

---

## Phase E — Personal Discovery (P1)

Ordre recommandé :

1. **DISC-P1-006** — Corrélation reco → visite probable (apprentissage)
2. **DISC-P1-003** — Insights (`discovery_insights`)
3. **DISC-P1-001** — Break the Loop
4. **DISC-P1-002** — My Radius complet
5. **DISC-P1-005** — Why This?
6. **DISC-P1-004** — Notifications discovery (extension `push-dispatch`)
7. **DISC-P1-007** — `activity_log` (optionnel ; funnel = `recommendation_events`)

Chaque lot = 1 branche, 1 PR, critères d'acceptation du ticket.

---

## Phase F — Life Intelligence (P2)

- Life Replay mensuel
- Attributs `events` enrichis (indoor, duration…)
- Météo scoring
- Partage social

Hors scope jusqu'à validation Phase E en prod.

---

## Ordre des PRs (résumé)

```
A1 schema → A2 RLS → A3 prefs → A4 types
                ↓
         A5 scoring → A6 jobs
                ↓
    B1 flags → B2 consent → B3 services → B4 UI → B5 teaser
                ↓
    C1 ingest → C2 capture → C3 scoring enrichi
                ↓
    D1 premium → D2 paywall
                ↓
         Phase E (P1) → Phase F (P2)
```

**Parallélisable :** A3 + A4 après A1 ; D1 pendant C2 si équipe > 1.

---

## Checklist anti-régression (chaque PR)

- [ ] Migration 100 % additive
- [ ] Aucune modification RLS tables engagement
- [ ] `event-checkin` non modifié (P0)
- [ ] `listEventsByBBox` / tri liste inchangés
- [ ] `EXPO_PUBLIC_DISCOVERY_ENABLED=false` → comportement identique pré-discovery
- [ ] `npm run typecheck` + `npm run lint`
- [ ] `home_location` / `notify_event_nearby` toujours fonctionnels

---

## Métriques de succès Phase B (Foundation)

| Métrique | Cible |
|----------|-------|
| Recommandation affichée | > 0 pour user avec ≥ 3 likes |
| Taux ouverture reco | Mesurable via `recommendation_events` |
| Régression flag off | 0 écran/route discovery visible |
| Consent opt-in | Traçable `discovery_consents` |

Métrique produit ultime (Phase E+) : **découverte réelle** = reco → visite probable ou check-in dans zone nouvelle.

---

## Ce qu'on ne fait pas (explicitement)

- Modifier le ranking de la carte ou de la liste existante
- Rendre la capture passive obligatoire pour une feature existante
- Fusionner `home_location` et `discovery_places`
- Greffer discovery dans `profiles`
- Modifier `activity_log` en P0
- Déployer capture background avec flag discovery global seul (flag capture séparé)
