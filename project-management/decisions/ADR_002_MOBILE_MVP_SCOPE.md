# ADR 002 - Mobile MVP Scope

## Status

Accepted.

## Context

Moments Locaux has a broad product surface: local event discovery, creation, profiles, social interactions, media, check-in, notifications, reports, shop, missions, offers, wallet/Lumo, gamification, creator analytics and moderation.

The MVP mobile app must be credible, focused and store-ready. The goal is not to add more features before release, but to make the core flows reliable.

## Decision

The mobile MVP is limited to user-facing local event discovery and creation flows.

## Visible In Mobile MVP

- Register, login, logout.
- Onboarding.
- Map discovery.
- Search and basic filters.
- Event list and event detail.
- Event creation with cover, location, date, category and submission.
- Creator event statuses: `draft`, `pending`, `published`, `refused`, `archived`.
- Refusal reason when available.
- Favorites.
- Like/interest if stable.
- Follow creator/member.
- Community profile basics.
- QR/location check-in.
- Notifications inbox.
- Report event.
- Report comment.
- Report profile/user.
- Profile edit.
- Settings.
- Account deletion.
- CGU and privacy policy.
- Bug/support contact.

## Hidden Or Guarded In Mobile MVP

- Admin moderation dashboard.
- Moderation queues.
- Approve/reject actions.
- Ban/warn/lift restriction actions.
- Media review admin.
- User risk dashboard.
- Shop.
- Missions.
- Offers.
- Wallet/Lumo advanced views.
- Deep gamification.
- Creator analytics dashboard.
- Fan segmentation tools.
- Placeholder settings.
- Legacy event creation routes not part of current flow.

## Post-MVP

- Web admin app.
- Shop.
- Missions.
- Offers/subscriptions.
- Wallet/Lumo advanced.
- Advanced gamification.
- Creator analytics.
- Advanced notifications/push.
- Advanced analytics.
- Advanced offline mode.

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

## Related Audits

- `audits/wave-1-publishable-mvp/01_MVP_SCOPE_NAVIGATION_AUDIT.md`
- `audits/wave-1-publishable-mvp/WAVE_1_EXECUTIVE_SUMMARY.md`
- `audits/wave-2-reliable-mvp/WAVE_2_EXECUTIVE_SUMMARY.md`
- `audits/wave-3-scalable-mvp/WAVE_3_EXECUTIVE_SUMMARY.md`
- `audits/standalone-audits/DESIGN_AUDIT.md`
- `MVP_SCOPE.md`
