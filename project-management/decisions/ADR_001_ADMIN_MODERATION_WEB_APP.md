# ADR 001 - Admin Moderation In A Separate Web App

## Status

Accepted.

## Context

Moments Locaux contains mobile routes and services for admin/moderator workflows: moderation dashboard, event review, comment review, user restrictions, media review, reports queue and contest moderation.

The MVP mobile objective is a simple, public, user-facing app for discovering, creating and interacting with local events. Admin moderation workflows are sensitive, operationally dense and security-critical. They should not be exposed in the mobile app.

## Decision

Admin moderation will not be managed in the mobile application.

It will be managed later through a dedicated web admin application.

The mobile app keeps only user-facing mechanisms:

- report an event
- report a comment
- report a profile/user
- view own event status: `draft`, `pending`, `published`, `refused`, `archived`
- view refusal reason when available
- delete account
- access CGU
- access privacy policy
- access support/contact when needed

## Consequences For Mobile UX

- No admin dashboard in drawer, tabs, profile or settings.
- No approve/reject buttons in mobile.
- No ban/warn/lift restriction actions in mobile.
- No media review admin queue in mobile.
- No user risk dashboard in mobile.
- Notifications must not route mobile users to admin moderation screens.
- Admin/moderator roles may exist in backend, but mobile navigation must not expose admin surfaces.

## Consequences For Supabase / RLS

- Mobile clients must not rely on UI hiding for admin security.
- Admin/moderation writes should be done through web admin + secure backend paths.
- Reports can be inserted from mobile by authenticated users.
- Reports, warnings and moderation actions should be readable only by admin/service-side contexts.
- RLS must prevent mobile users from reading or mutating moderation queues.
- Event status transitions must be protected server-side.

## Consequences For Navigation

Remove or guard mobile access to:

- `app/moderation/index`
- `app/moderation/events`
- `app/moderation/comments`
- `app/moderation/users`
- `app/moderation/reports`
- `app/moderation/media`
- `app/moderation/contests`

Mobile route guards should redirect non-MVP admin routes to a safe public screen or not register those routes in production.

## Risks

- Keeping admin screens in mobile increases scope, security risk and store-review ambiguity.
- Hiding links without route guards leaves deep-link access possible.
- Mobile admin code can drift from future web admin behavior.

## Related Audits

- `audits/wave-1-publishable-mvp/01_MVP_SCOPE_NAVIGATION_AUDIT.md`
- `audits/wave-1-publishable-mvp/04_SUPABASE_RLS_AUDIT.md`
- `audits/wave-1-publishable-mvp/06_GDPR_STORE_COMPLIANCE_AUDIT.md`
- `audits/wave-3-scalable-mvp/02_NOTIFICATIONS_AUDIT.md`
- `audits/wave-3-scalable-mvp/03_ABUSE_ANTI_SPAM_TRUST_SAFETY_AUDIT.md`
- `audits/standalone-audits/RLS_AUDIT.md`
- `audits/standalone-audits/GDPR_MVP_AUDIT.md`
