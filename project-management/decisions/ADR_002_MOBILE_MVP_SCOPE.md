# ADR 002 - Mobile MVP Scope

## Status

Accepted — amended 2026-06-08 and 2026-07-29.

## Context

Moments Locaux has a broad product surface: local event discovery, creation, profiles, social interactions, media, check-in, notifications, reports, shop, missions, offers, wallet/Lumo, gamification, creator analytics and moderation.

The MVP mobile app must be credible, focused and store-ready. The goal is not to add more features before release, but to make the core flows reliable.

## Decision

The mobile MVP is limited to **local event discovery** (browse / social / trust / notifications). Event creation and freemium surfaces are deferred behind feature flags (Amendment 2026-07-29). Supply for MVP comes from OpenAgenda ingestion; moderation ops live on the web console.

## Visible In Mobile MVP

- Register, login, logout.
- Social login (OAuth, e.g. Facebook). [Amendment 2026-06-08]
- Onboarding (Particulier / discovery identity — no Professionnel when Diffuseur flag off).
- Map discovery.
- Search and basic filters.
- Event list and event detail (published supply).
- Favorites.
- Like/interest if stable.
- **Peer social**: Membres (search/follow), peer profiles, “aimé par vos suivis” on events (`FEATURE_SOCIAL_PEERS`, default on).
- Comments.
- Notifications: inbox + push delivery + preferences center (per-type, geolocated radius/frequency) + triggers for new nearby events. [Amendment 2026-06-08] — not followed-creator-published.
- Report event.
- Report comment.
- Report profile/user.
- Profile edit.
- Settings.
- Account deletion.
- CGU and privacy policy.
- Bug/support contact.

## Hidden Or Guarded In Mobile MVP (flags default off — code retained)

- Event creation, mes events, ModeSwitch (`FEATURE_EVENT_CREATE` → V1).
- QR/location check-in (`FEATURE_CHECKIN` → V1).
- Nos offres / Habitué upsells (`FEATURE_OFFERS` → V1).
- Professionnel onboarding, Diffuseur packs/analytics (`FEATURE_DIFFUSEUR` → V1).
- Shop, missions, wallet/Lumo, pass (`FEATURE_GAMIFICATION` → V2).
- Discovery Engine (`FEATURE_DISCOVERY` → V2).
- Contests (`FEATURE_CONTESTS` → V2).
- Admin moderation dashboard / queues / approve-reject / ban / media review / risk (web console only — ADR 001).
- Placeholder settings, journey, invite, legacy create routes.

## Post-MVP / Phased

- **V1**: event create, check-in, offers/IAP, Diffuseur.
- **V2**: shop, missions, wallet/Lumo, Discovery Engine, contests, advanced gamification.
- Web admin app (beyond minimal console already in MVP).
- Advanced notification analytics / segmentation.
- Advanced analytics / offline mode.

## Decision Principles

- If a feature is not reliable, hide or guard it.
- If a feature is admin-only, move it out of mobile.
- If a feature creates store/GDPR/security risk, defer unless essential.
- If a feature helps the core local event loop, keep it and stabilize it.
- UI hiding is not enough; route guards and backend rules must enforce scope.

## Scope Creep Risks

- Reintroducing shop/missions/wallet before core flows are stable.
- Keeping admin surfaces in mobile because they already exist.
- Treating gamification as MVP instead of post-MVP.
- Adding analytics/push/offline before security, GDPR and lifecycle are stable.

## Amendment 2026-06-08

Product decision to bring two areas into the mobile MVP:

1. **Social login (OAuth)** — add provider-based sign-in (e.g. Facebook) alongside email/password.
2. **Notification system (basic)** — beyond the inbox: device push delivery, a preferences center (per-type toggles + geolocated radius/frequency, GDPR-consented), and new triggers for "new nearby event" and "followed creator published". Advanced notification analytics/segmentation stays post-MVP.

Rationale: these directly serve user retention and the core local-event loop, and the backend foundations (notifications table + trigger framework, PostGIS for geo) already exist in Supabase.

## Amendment 2026-07-29 — Discovery-only MVP + feature flags

Product decision during store stabilization:

### Mobile MVP visible scope (narrowed)

- Discovery loop: auth, onboarding Particulier, map/search/filters, event detail, favorites/likes/comments, notifications, reporting, settings/legal/delete.
- **Peer social**: find/follow members + “aimé par vos suivis” on events (`FEATURE_SOCIAL_PEERS`, default on).
- Event **supply** = OpenAgenda scraper (organizer Moments Locaux — no creator-follow).
- Companion web: moderation console + marketing vitrine only.

### Explicitly out / deferred

| Item | Phase |
|---|---|
| Creator-follow / followed-creator-published notifs / creator rankings | Out (scraper) |
| `FEATURE_EVENT_CREATE` | V1 |
| `FEATURE_CHECKIN` / `FEATURE_OFFERS` / `FEATURE_DIFFUSEUR` | V1 |
| `FEATURE_GAMIFICATION` / Discovery Engine / contests | V2 |

### Supersedes for MVP

- Mobile event creation is **not** required for the store-ready MVP (moved to V1).
- Creator/Discoverer mode switch is **not** MVP.
- Offers / check-in / Diffuseur are **not** MVP (V1).
- This does **not** remove social login or basic push from MVP (Amendment 2026-06-08 still stands).

See `MVP_SCOPE.md` for the live matrix and env keys.

## Related Audits

- `audits/wave-1-publishable-mvp/01_MVP_SCOPE_NAVIGATION_AUDIT.md`
- `audits/wave-1-publishable-mvp/WAVE_1_EXECUTIVE_SUMMARY.md`
- `audits/wave-2-reliable-mvp/WAVE_2_EXECUTIVE_SUMMARY.md`
- `audits/wave-3-scalable-mvp/WAVE_3_EXECUTIVE_SUMMARY.md`
- `audits/standalone-audits/DESIGN_AUDIT.md`
- `MVP_SCOPE.md`
