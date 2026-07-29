# MVP Scope

Store-ready **discovery-only** mobile MVP for Moments Locaux. Supply comes from OpenAgenda (scraper). Creation, freemium IAP, Diffuseur, and gamification stay in the codebase behind feature flags (default off).

Companion surfaces in MVP: **moderation WebConsole** + **marketing site vitrine** (not this repo).

## Visible MVP Features (flags off)

- Authentication: register, login, logout, persisted session, social login (OAuth).
- Onboarding: Particulier only (no Professionnel), location, avatar, themes — no create intent, no offers CTA.
- Map discovery: Mapbox map, visible-area event loading, search, filters, event preview, event details.
- Event browsing: home/list results, detail page, community profile links, sharing.
- Social basics: favorites, likes/interests, follow creator/member, community profiles, comments.
- Notifications: inbox, unread badge, notification routing, push delivery, preferences center.
- User reporting: report an event, comment, or profile (media report UI still a gap).
- Profile basics: edit profile, settings, bug report, account deletion, CGU / privacy.

## Feature flags (`src/config/features.ts`)

All post-MVP flags default **false**. Set `EXPO_PUBLIC_FEATURE_<NAME>=true` and restart Metro.

| Flag | Phase | Surfaces |
|---|---|---|
| *(none)* | MVP | Auth, onboarding léger, carte, social, notifs, report, settings légal/delete |
| `FEATURE_EVENT_CREATE` | V1 | Tab +, create flow, mes events, ModeSwitch, creator hub |
| `FEATURE_CHECKIN` | V1 | QR / geo check-in + creator QR share |
| `FEATURE_OFFERS` | V1 | Nos offres, Habitué upsells |
| `FEATURE_DIFFUSEUR` | V1 | Professionnel onboarding, packs, analytics pro |
| `FEATURE_GAMIFICATION` | V2 | Wallet, shop, missions, pass (alias: `EXPO_PUBLIC_GAMIFICATION_ENABLED`) |
| `FEATURE_DISCOVERY` | V2 | Discovery Engine (alias: `EXPO_PUBLIC_DISCOVERY_ENABLED`) |
| `FEATURE_DISCOVERY_CAPTURE` | V2 | Background capture |
| `FEATURE_CONTESTS` | V2 | Concours |

Code stays in the repo; nav + deep links + services early-return when flags are off.

## Scope Amendment 2026-07-29 (discovery-only MVP)

Product decision during stabilization:

- Event creation + Créateur/Découvreur mode switch → **V1** (not MVP).
- Check-in, Nos offres / IAP, Diffuseur B2B → **V1**.
- Lumo / shop / missions / Discovery Engine / contests → **V2** (flags already off).
- Cold start: OpenAgenda scraper (thousands of events).
- Web MVP: moderation console + site vitrine only.

## Scope Amendment 2026-06-08

- Social login (OAuth) and basic push + notification preferences remain in MVP.

## Hidden When Flags Off (code retained)

- Event creation stepper, mes events, ModeSwitch.
- Check-in / QR share.
- Nos offres / Habitué paywall.
- Diffuseur packs / analytics / Professionnel onboarding.
- Shop, missions, wallet Lumo, pass, contests, Discovery Engine.
- Admin moderation routes (redirect to map — ops on WebConsole).
- Advanced settings placeholders, journey, invite.

## Dormant Or Deferred Code

- `src/screens/events/EventCreateScreen.tsx` unreferenced by Expo Router.
- Duplicate auth store (`src/store/authStore.ts` vs `src/state/auth.ts`).
- Shop EUR purchase disabled in mobile provider.

## Critical Manual Test Matrix (MVP)

- Create an account / login / logout / OAuth.
- Complete onboarding (Particulier).
- Map + search + filters + event detail.
- Favorite, like, follow, community profile.
- Report event / comment / profile.
- Notifications inbox + preferences.
- Settings, legal, account deletion, bug report.
- Deep links to `/events/create/*`, `/profile/offers`, `/profile/wallet` redirect away when flags off.
- Guest map browse still works (anon RLS).

Run on iOS and Android real devices before store submission.

## Store Readiness Prerequisites

- App Store / Play copy aligned on **découverte locale** (no création promise).
- Production Supabase, Mapbox, Sentry public values.
- Account deletion functional for store review.
- `npm run typecheck` and `npm run lint`.
- Release/dev-client smoke on iOS and Android.

## Post-MVP TODO

- Flip `FEATURE_EVENT_CREATE` (+ check-in / offers) for V1.
- IAP StoreKit / Play Billing when `FEATURE_OFFERS` on.
- Diffuseur Stripe when `FEATURE_DIFFUSEUR` on.
- Reintroduce gamification / Discovery / contests via V2 flags when density justifies it.
