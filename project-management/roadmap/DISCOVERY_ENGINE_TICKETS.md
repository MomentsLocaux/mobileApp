# Discovery Engine Tickets

Post-MVP feature track. Prefix: `DISC-P*`. Depends on MVP store release (ADR 002).

Reference implementation plan: `DISCOVERY_ENGINE_IMPLEMENTATION_PLAN.md`
Architecture decision: `ADR_003_DISCOVERY_ENGINE_DOMAIN.md`

---

## Phase MVP — Discovery Foundation

### ID: DISC-P0-001

Titre: Schéma Supabase du domaine Discovery (tables + enums)

Priorité: P0

Source: Discovery Engine spec §17, ADR 003

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Supabase migration (additive)

Fichiers probablement concernés: `supabase/migrations/20260710_discovery_domain_schema.sql`

Description: Créer les tables `user_subscriptions`, `discovery_consents`, `discovery_places`, `discovery_visits`, `mobility_profiles`, `discovery_profiles`, `discovery_insights`, `event_recommendations`, `recommendation_events`, `discovery_daily_summaries` avec indexes PostGIS et contraintes.

Critères d'acceptation: Migration idempotente additive ; aucune modification destructive ; `npm run typecheck` passe après mise à jour des types ; migration validée humainement avant apply.

Commandes de vérification: revue SQL, `supabase db lint` si disponible, script diagnostic RLS.

Risques: Conflit avec tables préexistantes ; extension PostGIS non disponible sur environnement cible.

Dépendances: Aucune

Branche Git recommandée: `feat/disc-p0-discovery-schema`

---

### ID: DISC-P0-002

Titre: RLS et policies du domaine Discovery

Priorité: P0

Source: ADR 003, audits RLS existants

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Supabase RLS

Fichiers probablement concernés: `supabase/migrations/20260711_discovery_domain_rls.sql`, `supabase/diagnostics/*`

Description: Activer RLS sur toutes les tables discovery ; owner read ; deny client writes sur données dérivées ; service_role pour ingestion ; étendre `process_account_deletion` pour purger le domaine.

Critères d'acceptation: Utilisateur authentifié ne lit que ses lignes ; anon refuse ; service_role peut ingérer ; suppression compte efface discovery_*.

Commandes de vérification: scripts diagnostic anon/auth/owner/non-owner.

Risques: Fuite de coordonnées via SELECT trop permissif.

Dépendances: DISC-P0-001

Branche Git recommandée: `feat/disc-p0-discovery-rls`

---

### ID: DISC-P0-003

Titre: Extension user_preferences pour notifications Discovery

Priorité: P0

Source: Spec §18

Responsable / agent recommandé: Supabase Security Architect, Mobile Reliability Engineer

Type d'action: Supabase migration + mobile types

Fichiers probablement concernés: `supabase/migrations/20260712_discovery_notification_prefs.sql`, `src/services/preferences.service.ts`, `app/settings/notifications.tsx`

Description: Ajouter `discovery_push_enabled`, `right_now_push_enabled`, `break_loop_push_enabled`, `life_insight_push_enabled`, `discovery_max_push_per_week` à `user_preferences`. Mettre à jour le service et l'écran réglages (section Discovery, désactivée par feature flag tant que non livré).

Critères d'acceptation: Colonnes avec defaults sûrs ; UI reflète les champs ; RLS existant inchangé.

Commandes de vérification: `npm run typecheck`, `npm run lint`

Risques: Confusion UX avec `notify_event_nearby` existant.

Dépendances: DISC-P0-001

Branche Git recommandée: `feat/disc-p0-discovery-prefs`

---

### ID: DISC-P0-004

Titre: Edge Function discovery-ingest (visites et lieux)

Priorité: P0

Source: Spec §6, §19 couche 1–2

Responsable / agent recommandé: Supabase Security Architect, Mobile Reliability Engineer

Type d'action: Edge Function

Fichiers probablement concernés: `supabase/functions/discovery-ingest/index.ts`, `src/services/discovery/discovery-sync.service.ts`

Description: Endpoint authentifié recevant des batches de visites dérivées (pas de trace GPS brute longue durée). Vérifie `discovery_consents.enabled` et `location_enabled`. Upsert places (clustering côté serveur V1 simple). Insère visites.

Critères d'acceptation: Refus si consentement absent ; validation schéma ; idempotence par `client_visit_id` ; logs sans coordonnées précises en clair.

Commandes de vérification: tests Deno locaux, invocation manuelle avec JWT test.

Risques: Volume de données ; coût Edge ; clustering naïf insuffisant.

Dépendances: DISC-P0-001, DISC-P0-002

Branche Git recommandée: `feat/disc-p0-discovery-ingest`

---

### ID: DISC-P0-005

Titre: Collecte passive mobile (on-device V1)

Priorité: P0

Source: Spec §6.1, §19 couche 1

Responsable / agent recommandé: Mobile Reliability Engineer, GDPR Officer

Type d'action: Mobile architecture

Fichiers probablement concernés: `src/services/discovery/discovery-capture.service.ts`, `src/tasks/discovery-location.task.ts`, `app.json` / `app.config.ts` (permissions), `src/hooks/useDiscoveryCapture.ts`

Description: Implémenter détection arrêts/déplacements on-device avec `expo-location` + `expo-task-manager`. Buffer local chiffré ou AsyncStorage avec TTL. Sync périodique vers `discovery-ingest`. Respecter consentement et état app (foreground/background selon OS).

Critères d'acceptation: Aucune collecte sans consentement ; arrêt immédiat si révocation ; pas de stockage serveur de points bruts en MVP ; batterie acceptable sur scénario 8h.

Commandes de vérification: `npm run typecheck`, `npm run lint`, test manuel iOS + Android.

Risques: Rejet App Store si justification localisation Always insuffisante ; dérive batterie.

Dépendances: DISC-P0-004, DISC-P0-007

Branche Git recommandée: `feat/disc-p0-discovery-capture`

---

### ID: DISC-P0-006

Titre: Moteur de scoring V1 + génération Right Now

Priorité: P0

Source: Spec §8, §11, §20

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Edge Function + SQL RPC

Fichiers probablement concernés: `supabase/functions/discovery-score/index.ts`, `supabase/migrations/20260713_discovery_scoring_rpc.sql`

Description: Implémenter scoring pondéré V1 (affinité, géo, horaire, mobilité, nouveauté, contexte). Générer recommandations `right_now` et `for_you` simples. Persister dans `event_recommendations` avec `reason_codes` et `valid_until`.

Critères d'acceptation: Score configurable via constantes ; candidats = événements `published` dans fenêtre temporelle ; géo via PostGIS `ST_DWithin` ; free = 1 Right Now/jour, Premium = flux complet.

Commandes de vérification: tests unitaires scoring, seed events + profil test.

Risques: Cold start sans historique ; performances sur grand catalogue.

Dépendances: DISC-P0-001, DISC-P0-004

Branche Git recommandée: `feat/disc-p0-discovery-scoring`

---

### ID: DISC-P0-007

Titre: Onboarding Discovery + gestion consentement

Priorité: P0

Source: Spec §3.4, §15.1, §15.5

Responsable / agent recommandé: UX/UI Guardian, GDPR Officer

Type d'action: Mobile UX + API

Fichiers probablement concernés: `app/onboarding/discovery.tsx`, `app/settings/discovery.tsx`, `src/services/discovery/discovery-consent.service.ts`

Description: Parcours 3 écrans valeur → contrôle → activation. Persistance `discovery_consents`. Révocation et purge demande utilisateur. Feature flag `EXPO_PUBLIC_DISCOVERY_ENABLED`.

Critères d'acceptation: Consentement versionné ; révocation stoppe capture ; lien politique confidentialité ; distinct du paywall Premium.

Commandes de vérification: `npm run typecheck`, `npm run lint`, parcours manuel.

Risques: Dark patterns ; confusion consentement vs Premium.

Dépendances: DISC-P0-001, DISC-P0-002

Branche Git recommandée: `feat/disc-p0-discovery-consent`

---

### ID: DISC-P0-008

Titre: Statut Premium (user_subscriptions + entitlement check)

Priorité: P0

Source: Spec §13, §17.1

Responsable / agent recommandé: Release Manager, Supabase Security Architect

Type d'action: Backend + mobile guard

Fichiers probablement concernés: `supabase/migrations/20260714_user_subscriptions.sql`, `supabase/functions/subscription-webhook/index.ts`, `src/services/subscription.service.ts`, `src/hooks/usePremiumEntitlement.ts`

Description: Table `user_subscriptions` ; webhook stub RevenueCat/StoreKit (provider configurable) ; RPC `get_user_entitlement(user_id)` ; hook mobile lecture seule. Remplacer progressivement `offersStore` local.

Critères d'acceptation: Client ne peut pas s'auto-attribuer Premium ; grace_period géré ; statut visible dans réglages.

Commandes de vérification: tests RPC, mock webhook.

Risques: Intégration store non finalisée — commencer par stub + feature flag interne.

Dépendances: DISC-P0-001

Branche Git recommandée: `feat/disc-p0-premium-entitlement`

---

### ID: DISC-P0-009

Titre: UI Right Now + For You simple + réactions recommandation

Priorité: P0

Source: Spec §4.1, §4.2, §11

Responsable / agent recommandé: UX/UI Guardian

Type d'action: Mobile screens

Fichiers probablement concernés: `app/discovery/index.tsx`, `src/components/discovery/RightNowCard.tsx`, `src/services/discovery/discovery-recommendations.service.ts`, `src/screens/events/EventDetailScreen.tsx`

Description: Discovery Home minimal avec Right Now et For You (classement basique). Actions Voir / Pas maintenant / Ça m'intéresse / Itinéraire. Écriture `recommendation_events` et timestamps sur `event_recommendations`.

Critères d'acceptation: États `displayed` → `opened` / `dismissed` / `route_requested` tracés ; gratuit voit 1 suggestion Right Now ; Premium voit flux.

Commandes de vérification: `npm run typecheck`, `npm run lint`, test funnel manuel.

Risques: Sur-promesse UX avant profil mûr.

Dépendances: DISC-P0-006, DISC-P0-008

Branche Git recommandée: `feat/disc-p0-discovery-ui`

---

### ID: DISC-P0-010

Titre: Paywall Premium contextuel (aperçu → unlock)

Priorité: P0

Source: Spec §14

Responsable / agent recommandé: Product Owner MVP, UX/UI Guardian

Type d'action: Mobile UX

Fichiers probablement concernés: `src/components/discovery/PremiumPaywallSheet.tsx`, `app/profile/subscription.tsx`

Description: Paywall après valeur perçue (aperçu insight ou My Radius teaser). Tracking `premium_paywall_view` via `recommendation_events` ou `activity_log`. Pas de paywall à l'installation.

Critères d'acceptation: Déclenché seulement après signal discovery ; prix affiché 2,99 €/mois et 19,99 €/an ; restore purchases prévu.

Commandes de vérification: parcours manuel, `npm run typecheck`

Risques: Rejet store si achat in-app non fonctionnel — garder derrière flag jusqu'à IAP réel.

Dépendances: DISC-P0-008, DISC-P0-009

Branche Git recommandée: `feat/disc-p0-premium-paywall`

---

### ID: DISC-P0-011

Titre: Jobs profil mobilité et discovery_profiles (cron)

Priorité: P0

Source: Spec §7.4, §7.5, §19 couche 3

Responsable / agent recommandé: Supabase Security Architect

Type d'action: pg_cron + SQL

Fichiers probablement concernés: `supabase/migrations/20260715_discovery_profile_jobs.sql`

Description: Recalcul quotidien `mobility_profiles`, `discovery_profiles`, `discovery_daily_summaries` à partir des visites et signaux engagement existants (`event_checkins`, likes, favorites, interests).

Critères d'acceptation: Job idempotent ; `calculated_at` mis à jour ; affinités JSONB peuplées ; utilisateurs sans consentement exclus.

Commandes de vérification: exécution manuelle job sur jeu de test.

Risques: Charge DB ; profils vides les premiers jours.

Dépendances: DISC-P0-004, DISC-P0-006

Branche Git recommandée: `feat/disc-p0-discovery-profiles`

---

### ID: DISC-P0-012

Titre: Types TypeScript et data-provider Discovery

Priorité: P0

Source: ADR 003

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Types + services

Fichiers probablement concernés: `src/types/database.ts`, `src/types/discovery.types.ts`, `src/data-provider/supabase-provider.ts`

Description: Étendre les types générés/manuels pour toutes les tables discovery. Créer interfaces `DiscoveryPlace`, `DiscoveryVisit`, `EventRecommendation`, etc.

Critères d'acceptation: `npm run typecheck` sans `any` non justifié sur le module discovery.

Commandes de vérification: `npm run typecheck`, `npm run lint`

Risques: Dérive types/schéma.

Dépendances: DISC-P0-001

Branche Git recommandée: `feat/disc-p0-discovery-types`

---

## Phase 2 — Personal Discovery (P1)

### ID: DISC-P1-001

Titre: Break the Loop (détection + UI + recommandations)

Priorité: P1

Source: Spec §4.3

Responsable / agent recommandé: Product Owner MVP, UX/UI Guardian

Type d'action: Scoring + UI Premium

Fichiers probablement concernés: `supabase/functions/discovery-score/index.ts`, `app/discovery/break-the-loop.tsx`

Description: Détecter `repetitive_weekends` et `no_new_place_recently` ; générer 3 propositions `break_the_loop` ; UI Premium.

Critères d'acceptation: Insight actionnable ; langage non jugeant ; Premium only.

Dépendances: DISC-P0-011, DISC-P0-009

Branche Git recommandée: `feat/disc-p1-break-the-loop`

---

### ID: DISC-P1-002

Titre: My Radius (aperçu → complet Premium)

Priorité: P1

Source: Spec §4.4, §15.3

Responsable / agent recommandé: UX/UI Guardian

Type d'action: Mobile + map

Fichiers probablement concernés: `app/discovery/my-radius.tsx`, `src/components/discovery/RadiusMap.tsx`

Description: Visualisation territoire 30 jours ; lieux habituels ; nouvelles zones ; 3 suggestions d'élargissement. Gratuit = teaser chiffré ; Premium = détail.

Dépendances: DISC-P0-011

Branche Git recommandée: `feat/disc-p1-my-radius`

---

### ID: DISC-P1-003

Titre: Insights discovery + table discovery_insights

Priorité: P1

Source: Spec §7.6

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Job + API

Fichiers probablement concernés: `supabase/migrations/20260720_discovery_insights_job.sql`

Description: Générer insights typés avec `valid_until`, `confidence`, `seen_at`. Exposer via RPC `get_active_insights`.

Dépendances: DISC-P0-011

Branche Git recommandée: `feat/disc-p1-discovery-insights`

---

### ID: DISC-P1-004

Titre: Notifications intelligentes Discovery

Priorité: P1

Source: Spec §12

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Cron + push-dispatch extension

Fichiers probablement concernés: `supabase/migrations/20260721_discovery_notifications.sql`, `supabase/functions/push-dispatch/index.ts`

Description: Types Opportunity Now, Break the Loop, New Area, Personal Match, Life Insight. Anti-spam : cooldown, max/semaine, quiet hours.

Dépendances: DISC-P0-003, DISC-P0-006

Branche Git recommandée: `feat/disc-p1-discovery-notifications`

---

### ID: DISC-P1-005

Titre: Why This? (explication recommandation)

Priorité: P1

Source: Spec §15.4

Responsable / agent recommandé: UX/UI Guardian

Type d'action: Mobile UI

Fichiers probablement concernés: `src/components/discovery/WhyThisSheet.tsx`

Description: Afficher `reason_codes` en langage naturel (distance, affinité, nouveauté zone, horaire).

Dépendances: DISC-P0-006

Branche Git recommandée: `feat/disc-p1-why-this`

---

### ID: DISC-P1-006

Titre: Boucle apprentissage — corrélation recommandation → visite probable

Priorité: P1

Source: Spec §10 étapes 4–5

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Job + scoring feedback

Fichiers probablement concernés: `supabase/migrations/20260722_discovery_outcome_matching.sql`

Description: Matcher visites post-recommandation ; passer état `probable_visit` / `confirmed_checkin` ; renforcer affinités.

Dépendances: DISC-P0-004, DISC-P0-006

Branche Git recommandée: `feat/disc-p1-discovery-learning`

---

### ID: DISC-P1-007

Titre: Étendre activity_log (CHECK + RLS + actions discovery)

Priorité: P1

Source: Spec §18, audit live DB 2026-07-10

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Migration + instrumentation mobile

Fichiers probablement concernés: `supabase/migrations/20260723_activity_log_extend.sql`, `src/services/activity-log.service.ts`

Description: La table `activity_log` existe déjà en prod (RLS on, 0 policy, CHECK limité à 6 actions). Étendre le CHECK avec `view_recommendation`, `dismiss_recommendation`, `open_recommendation`, `route_requested`, `share_event`, `premium_paywall_view`, `premium_trial_started`, `premium_subscribed`. Ajouter policy INSERT owner + RPC `log_activity`. Le funnel discovery principal reste dans `recommendation_events`.

Dépendances: DISC-P0-009

Branche Git recommandée: `feat/disc-p1-activity-log`

---

## Phase 3 — Life Intelligence (P2)

### ID: DISC-P2-001

Titre: Life Replay mensuel

Priorité: P2

Source: Spec §5

Responsable / agent recommandé: Product Owner MVP

Type d'action: Rapport + UI Premium

Fichiers probablement concernés: `app/discovery/life-replay.tsx`

Description: Synthèse mensuelle découvertes, lieux, km, communes. Premium only.

Dépendances: DISC-P1-006, DISC-P1-002

Branche Git recommandée: `feat/disc-p2-life-replay`

---

### ID: DISC-P2-002

Titre: Attributs événements enrichis (indoor, audience, duration…)

Priorité: P2

Source: Spec §18 events

Responsable / agent recommandé: Product Owner MVP

Type d'action: Schema + create flow

Fichiers probablement concernés: `supabase/migrations/20260730_events_discovery_attributes.sql`, `app/events/create/*`

Description: Colonnes optionnelles pour améliorer Right Now (météo phase ultérieure).

Dépendances: DISC-P0-006

Branche Git recommandée: `feat/disc-p2-event-attributes`

---

### ID: DISC-P2-003

Titre: Rapports annuels et partage social Life Replay

Priorité: P2

Source: Spec §5, §22

Responsable / agent recommandé: UX/UI Guardian

Type d'action: UI + export image

Fichiers probablement concernés: `src/components/discovery/LifeReplayShareCard.tsx`

Description: Carte partageable ; rétention annuelle Premium.

Dépendances: DISC-P2-001

Branche Git recommandée: `feat/disc-p2-life-replay-share`

---

### ID: DISC-P2-004

Titre: Intégration météo pour Right Now

Priorité: P2

Source: Spec §4.1

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Service externe + scoring

Fichiers probablement concernés: `src/services/weather.service.ts`, `supabase/functions/discovery-score/index.ts`

Description: Pondérer événements outdoor/indoor selon météo locale.

Dépendances: DISC-P2-002

Branche Git recommandée: `feat/disc-p2-weather-scoring`

---

## Ordre d'exécution recommandé

```
DISC-P0-001 → DISC-P0-002 → DISC-P0-012
              ↓
DISC-P0-003, DISC-P0-007, DISC-P0-008 (parallèle)
              ↓
DISC-P0-004 → DISC-P0-005
              ↓
DISC-P0-011 → DISC-P0-006 → DISC-P0-009 → DISC-P0-010
              ↓
         Phase P1 puis P2
```
