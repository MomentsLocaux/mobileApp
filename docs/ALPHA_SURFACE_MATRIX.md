# Alpha surface matrix (SCRUM-181)

Freeze produit 4–8 septembre 2026. Ticket parent : [SCRUM-179](https://moments-locaux.atlassian.net/browse/SCRUM-179).

Git freeze : tag `archive/pre-alpha-cleanup` + branches `feat/v1-*`, `feat/v2-*`, `feat/spike-roadtrip`.

Ne pas confondre **Discovery Engine** (PARK) et les **filtres carte / accueil** (`discovery-filters`, `discoveryFiltersStore`, `map-discovery-contract`, `DiscoveryLoadingState`).

Ne pas extraire le stepper de suggestion, `LocationPickerModal` (corrections), ni `expo-task-manager` + localisation Always (alertes proximité).

Migrations SQL : append-only, jamais rewind.

## KEEP

| Surface | Notes |
|---|---|
| Auth, onboarding Particulier | Pas de Professionnel / Diffuseur |
| Carte, accueil, recherche, détail event | Filtres carte (pas le moteur Discovery) |
| Social pairs | `FEATURE_SOCIAL_PEERS` ON |
| Favoris, likes, commentaires, signalements | |
| Notifs proximité | `proximity-location` + Always |
| Propositions (swipe) | Pas de flag |
| Corrections + FAB + Mes suggestions | |
| Suggestion depuis affiche | `FEATURE_EVENT_SUGGEST` ON — stepper partagé |
| Tour Lumia + chat | `FEATURE_LUMIA_CHAT` ON |
| CGU / privacy / delete / export | |

## PARK (code retiré du tree Alpha, conservé sur branches feature)

| Cluster | Flag / routes | Branche |
|---|---|---|
| Chrome organisateur | `FEATURE_EVENT_CREATE` — ModeSwitch, Mes events orga, onglet Create orga | `feat/v1-event-create` |
| Check-in QR / geo | `FEATURE_CHECKIN` | `feat/v1-checkin` |
| Offres / Habitué | `FEATURE_OFFERS` | `feat/v1-offers` |
| Diffuseur / Professionnel | `FEATURE_DIFFUSEUR` | `feat/v1-diffuseur` |
| Lumo / shop / missions / pass | `FEATURE_GAMIFICATION` | `feat/v2-gamification` |
| Discovery Engine | `FEATURE_DISCOVERY` | `feat/v2-discovery` |
| Concours | `FEATURE_CONTESTS` | `feat/v2-contests` |
| Roadtrip | `FEATURE_ROADTRIP` | `feat/spike-roadtrip` |
| Admin mobile mort | `/moderation/*`, `/creator/*`, `/profile/journey` | n/a (dead) |

## SHARED (reste dans Alpha)

- `app/events/create/*` stepper — utilisé par la suggestion
- `LocationPickerModal`
- `expo-task-manager` + permission Always
- Types DB Discovery / abonnements (tables SQL encore présentes)

## DEAD (retirés)

- `app/moderation/*`, `src/screens/moderation/*`
- `app/creator/*` (dashboard / fans / index)
- `app/profile/journey.tsx`
