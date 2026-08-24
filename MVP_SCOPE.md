# MVP Scope

Store-ready **discovery + peer social** mobile MVP for Moments Locaux. Event supply = OpenAgenda scraper (organizer “Moments Locaux”). Creation, freemium IAP, Diffuseur, and gamification stay behind feature flags (default off).

Companion surfaces in MVP: **moderation WebConsole** + **marketing site vitrine**.

## Visible MVP Features

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
- Notifications: inbox, push, preferences MVP (nearby + rayon + rythme, proximity live, rappels, activité sociale pairs, thèmes, budget/quiet). Pas de « créateur suivi », récompenses/missions, ni Discovery (flags off).
- User reporting: event, comment, profile.
- Profile basics: edit, settings, bug report, account deletion, CGU / privacy.

## Feature flags (`src/config/features.ts`)

| Flag | Default | Phase | Surfaces |
|---|---|---|---|
| `FEATURE_SOCIAL_PEERS` | **ON** (`=false` to hide) | MVP | Membres, peer follow, aimé par suivis |
| `FEATURE_EVENT_CREATE` | off | V1 | Create, mes events, ModeSwitch |
| `FEATURE_CHECKIN` | off | V1 | QR / geo check-in |
| `FEATURE_OFFERS` | off | V1 | Nos offres |
| `FEATURE_DIFFUSEUR` | off | V1 | Professionnel / Diffuseur |
| `FEATURE_GAMIFICATION` | off | V2 | Lumo / shop / missions / pass |
| `FEATURE_DISCOVERY` | off | V2 | Discovery Engine |
| `FEATURE_CONTESTS` | off | V2 | Concours |
| `FEATURE_LUMIA_CHAT` | off | Post-MVP | Lumia assistant chat |
| `FEATURE_EVENT_SUGGEST` | off | V1 | Suggest event from poster (AI prefill) |

## Out of MVP (scraper reality)

- Follow event organizer / Moments Locaux account.
- Creator directory rankings (events / Lumo).
- Notif « créateur suivi a publié ».
- Full activity feed / DMs / friend requests (asymmetrical follow is enough).
- Contact-book scan / “who already has the app” matching (deferred — needs optional verified phone or email hash pipeline; no phone required at signup).

## Scope Amendment 2026-07-29

- Discovery-only supply (OpenAgenda) + peer social slice.
- Event creation / ModeSwitch / check-in / offers / Diffuseur → V1.
- Gamification / Discovery Engine / contests → V2.
- Friend growth: share-link invite in MVP; contact matching → V1+ (opt-in identifiers only).

## Scope Amendment 2026-06-08

- Social login (OAuth) and basic push + notification preferences remain in MVP.

## Critical Manual Test Matrix (MVP)

- Auth + onboarding Particulier.
- Map / search / event detail (organizer Moments Locaux, no Suivre orga).
- Membres: search, follow, open peer profile, report; invite share from empty state / profile.
- Like/favorite an event → appears on “Aimé par vos suivis” for followers.
- Favorites, comments, notifications prefs, delete account.
- Flags off deep links for create/offers still redirect.
- After human apply of `20260810_list_event_engaged_by_following` on DEV: “Aimé par vos suivis” returns peers under RLS.

Run on iOS and Android before store submission.

## Store Readiness Prerequisites

- Store copy = découverte locale + voisins (pas création).
- Production Supabase, Mapbox, Sentry.
- Account deletion functional.
- `npm run typecheck` and `npm run lint`.
