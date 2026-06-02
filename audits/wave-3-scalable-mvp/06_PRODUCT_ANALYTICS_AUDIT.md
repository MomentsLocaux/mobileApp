# 06 - Product Analytics Audit

## Résumé exécutif

Le repo contient du tracking partiel via `event_views`, mais pas de stack analytics produit complète. Pour le MVP, il ne faut pas sur-tracker : il faut mesurer le funnel d'activation, la découverte, la création, l'engagement et les points de friction, avec consentement et minimisation.

Niveau actuel : analytics produit embryonnaire.

## Constats

### Tracking existant

- `EventDetailScreen` insère dans `event_views`.
- Le tracking est limité par AsyncStorage à une vue par événement/jour côté device.
- `EventCardStatsService` agrège les vues via RPC ou fallback.
- Pas d'outil type PostHog/Amplitude/Mixpanel identifié.

### Funnel non instrumenté

Événements recommandés non observés comme tracking structuré :

- `app_opened`
- `signup_started`
- `signup_completed`
- `onboarding_completed`
- `location_permission_granted`
- `location_permission_refused`
- `search_performed`
- `event_viewed`
- `event_favorited`
- `event_create_started`
- `event_draft_saved`
- `event_submitted`
- `event_published`
- `checkin_completed`
- `report_submitted`
- `account_deleted`

### Privacy

- Analytics doit être décrit dans la politique de confidentialité.
- Éviter tracking nominatif inutile.
- Privilégier user id pseudonymisé.
- Permettre opt-out si analytics non essentiels.

### Mesure MVP utile

Metrics prioritaires :

- activation : signup -> onboarding -> première recherche.
- découverte : recherche -> event viewed.
- engagement : favorite/follow/check-in.
- création : start -> draft -> submit -> published/refused.
- trust : reports submitted.
- rétention : app opened, notification opened.

## Risques

- Pilotage produit impossible sans données.
- Trop de tracking ajouté trop tôt, risquant privacy/store.
- `event_views` exposé ou coûteux si RLS/RPC fragile.
- Confusion analytics produit vs logs techniques.
- Données non anonymisées.

## Recommandations

- Définir un plan de tracking minimal.
- Centraliser `track(eventName, properties)` derrière un service.
- Ne pas ajouter de librairie lourde avant décision.
- Commencer avec table `analytics_events` ou Edge Function si Supabase suffit.
- Minimiser properties :
  - event type
  - timestamp
  - user id pseudonymisé ou nullable
  - screen/action
  - ids ressource si nécessaire
- Ne jamais tracker contenu libre complet.
- Documenter dans privacy.

## Quick wins

- Formaliser tracking plan MVP.
- Garder `event_views`, mais sécuriser RLS/RPC.
- Ajouter analytics uniquement sur P0 funnel.
- Ajouter opt-out si analytics non essentiels.

## Tracking plan recommandé

| Event | Quand | Properties minimales |
| --- | --- | --- |
| `app_opened` | ouverture app | platform, version |
| `signup_started` | register ouvert | method |
| `signup_completed` | compte créé | method |
| `onboarding_completed` | onboarding fini | city_present |
| `location_permission_granted` | permission acceptée | source_screen |
| `location_permission_refused` | permission refusée | source_screen |
| `search_performed` | recherche appliquée | has_where, has_when, has_category |
| `event_viewed` | détail ouvert | event_id, source |
| `event_favorited` | favori ajouté | event_id |
| `event_create_started` | step création ouvert | source |
| `event_draft_saved` | brouillon sauvegardé | has_cover |
| `event_submitted` | submit pending | visibility, category |
| `event_published` | publication validée | backend only |
| `checkin_completed` | check-in validé | event_id |
| `report_submitted` | signalement envoyé | target_type, reason |
| `account_deleted` | suppression compte | backend only |

## Fichiers concernés

- `src/screens/events/EventDetailScreen.tsx`
- `src/services/event-card-stats.service.ts`
- `src/data-provider/supabase-provider.ts`
- `src/screens/auth/*`
- `src/screens/onboarding/OnboardingScreen.tsx`
- `app/events/create/*`
- `src/services/report.service.ts`
- `src/services/checkin.service.ts`
- `app/settings/privacy/policy.tsx`

## Scénarios à tester

- Tracking désactivé.
- Tracking utilisateur guest.
- Tracking utilisateur connecté.
- Recherche sans localisation.
- Création événement abandonnée.
- Brouillon sauvegardé.
- Event submitted.
- Report submitted.
- Account deleted.

## Priorisation

### P0

- Sécuriser `event_views`.
- Documenter analytics dans privacy si ajouté.
- Ne pas tracker données sensibles libres.

### P1

- Ajouter service tracking minimal.
- Mesurer funnel activation/création.
- Ajouter dashboard simple.

### P2

- Cohortes/rétention.
- A/B tests.
- Analytics créateur avancés.
