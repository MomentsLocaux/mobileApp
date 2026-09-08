# MVP Scope

Store-ready **discovery + peer social** mobile **Alpha** for Moments Locaux. Event supply = OpenAgenda scraper (organizer “Moments Locaux”). Parked V1/V2 surfaces live on feature branches (see `docs/ALPHA_SURFACE_MATRIX.md`).

Companion surfaces in MVP: **moderation WebConsole** + **marketing site vitrine**.

## Visible Alpha Features

- Authentication: register, login, logout, persisted session, social login (OAuth).
- Onboarding: Particulier only (no Professionnel), location, avatar, themes — no create intent, no offers CTA.
- Map discovery: Mapbox map, visible-area event loading, search, filters, **saved/recent searches (local)**, event preview, event details. (Pas d’alertes push « nouveaux résultats » — hors MVP.)
- Event browsing: home/list, detail, sharing. Organizer shown as Moments Locaux (no creator-follow).
- **Peer social (default on — `FEATURE_SOCIAL_PEERS`)**:
  - Drawer **Membres**: search + follow other app users (not creator rankings).
  - Member profile `/community/[id]` for peers (follow + report).
  - Event detail: **Aimé par vos suivis** (likes/favorites from people you follow).
  - **Inviter des amis**: system share sheet + app link only (no contacts scan, no phone at signup).
- Favorites, likes/interests, comments.
- Notifications: inbox, push, preferences MVP (nearby + rayon + rythme, proximity live, rappels, activité sociale pairs, thèmes, budget/quiet). Pas de « créateur suivi », récompenses/missions, ni Discovery Engine.
- User reporting: event, comment, profile.
- Community corrections + contribution FAB + **Mes suggestions**.
- **Suggestion depuis une affiche** (`FEATURE_EVENT_SUGGEST` ON) — stepper partagé, sans chrome organisateur.
- **Tour Lumia + chat** (`FEATURE_LUMIA_CHAT` ON).
- Propositions (swipe).
- Profile basics: edit, settings, bug report, account deletion, CGU / privacy.

## Feature flags (`src/config/features.ts`)

Canal Alpha = EAS **production** et **preview** (aligné `.env` local).

| Flag | Alpha | Phase | Surfaces |
|---|---|---|---|
| `FEATURE_SOCIAL_PEERS` | **ON** (`=false` to hide) | Alpha | Membres, peer follow, aimé par suivis |
| `FEATURE_EVENT_SUGGEST` | **ON** | Alpha | Suggest event from poster (AI prefill) |
| `FEATURE_LUMIA_CHAT` | **ON** | Alpha | Lumia assistant chat + tour |
| `FEATURE_EVENT_CREATE` | off (parked) | V1 | Create chrome, mes events, ModeSwitch |
| `FEATURE_CHECKIN` | off (parked) | V1 | QR / geo check-in |
| `FEATURE_OFFERS` | off (parked) | V1 | Nos offres |
| `FEATURE_DIFFUSEUR` | off (parked) | V1 | Professionnel / Diffuseur |
| `FEATURE_GAMIFICATION` | off (parked) | V2 | Lumo / shop / missions / pass |
| `FEATURE_DISCOVERY` | off (parked) | V2 | Discovery Engine |
| `FEATURE_CONTESTS` | off (parked) | V2 | Concours |

## Out of Alpha (parked on feature branches)

- Organizer create chrome (`feat/v1-event-create`) — stepper kept for suggestions.
- Check-in, offers/Habitué, Diffuseur, Lumo, Discovery Engine, contests, roadtrip.
- Follow event organizer / Moments Locaux account.
- Creator directory rankings (events / Lumo).
- Notif « créateur suivi a publié ».
- Full activity feed / DMs / friend requests (asymmetrical follow is enough).
- Contact-book scan / “who already has the app” matching (deferred).
- Admin mobile routes (`/moderation/*`, creator dashboard, journey).

## Scope Amendment 2026-09-08 (Alpha cleanup)

- Visible product freeze = Alpha MVP. Parked code extracted to feature branches from tag `archive/pre-alpha-cleanup`.
- EAS production/preview: `FEATURE_LUMIA_CHAT=true`, `FEATURE_EVENT_SUGGEST=true`.
- Do not rewind SQL migrations.

## Scope Amendment 2026-07-29

- Discovery-only supply (OpenAgenda) + peer social slice.
- Event creation / ModeSwitch / check-in / offers / Diffuseur → V1.
- Gamification / Discovery Engine / contests → V2.
- Friend growth: share-link invite in MVP; contact matching → V1+ (opt-in identifiers only).

## Scope Amendment 2026-06-08

- Social login (OAuth) and basic push + notification preferences remain in MVP.

## Critical Manual Test Matrix (Alpha)

- Auth + onboarding Particulier.
- Map / search / event detail (organizer Moments Locaux, no Suivre orga).
- Membres: search, follow, open peer profile, report; invite share from empty state / profile.
- Like/favorite an event → appears on “Aimé par vos suivis” for followers.
- Favorites, comments, notifications prefs, delete account.
- Suggest from poster + Mes suggestions.
- Lumia tour + chat.
- Propositions swipe + community correction.
- Deep links hors-Alpha → page introuvable / retour carte.
- After human apply of `20260810_list_event_engaged_by_following` on DEV: “Aimé par vos suivis” returns peers under RLS.

Run on iOS and Android before store submission.

## Store Readiness Prerequisites

- Store copy = découverte locale + voisins + suggestion + Lumia (pas création organisateur).
- Production Supabase, Mapbox, Sentry.
- Account deletion functional.
- `npm run typecheck` and `npm run lint`.
