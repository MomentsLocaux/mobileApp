# ADR 003 - Discovery Engine As An Autonomous Domain

## Status

Proposed.

## Context

Moments Locaux is evolving from a passive event catalogue toward a personalized local discovery engine. The functional spec introduces seven new business objects (Discovery Consent, Place, Visit, Mobility Profile, Discovery Profile, Insight, Recommendation), passive location collection, Premium entitlements, and a behavioral learning loop.

The current schema already contains rich engagement signals (`event_views`, `favorites`, `event_likes`, `event_interests`, `event_checkins`) and a single geo snapshot (`user_preferences.home_location`). PostGIS is enabled for `events.location`, `event_checkins.location`, and `user_preferences.home_location`.

The mobile app today uses foreground location only (`expo-location`), has no background tracking, no subscription backend, and ranks events by `created_at` or client-side sort — not by personalization.

## Decision

1. **Discovery is a separate bounded context** implemented as `discovery_*` tables and dedicated Edge Functions. We will not add discovery state columns to `profiles`.

2. **Minimal extension of `user_preferences`** is allowed only for notification delivery toggles (`discovery_push_enabled`, etc.). Consent, profiles, places, visits, and recommendations live in dedicated tables.

3. **Premium entitlement is server-side truth** via `user_subscriptions`. The mobile client may cache entitlement for UX but never authorizes Premium features alone.

4. **Consent is distinct from Premium**. Free users with Discovery consent contribute signals; Premium unlocks depth of experience (Break the Loop, My Radius, advanced Right Now, etc.).

5. **Passive location follows minimization**: on-device interpretation first, derived data uploaded, raw GPS points not stored indefinitely server-side in MVP.

6. **Recommendation lifecycle is traceable** via `event_recommendations` + `recommendation_events`. This replaces ad-hoc analytics for the discovery funnel.

7. **Discovery is post-MVP** relative to store-ready mobile MVP (ADR 002). It must not block MVP release. Implementation proceeds in three phases: Foundation → Personal Discovery → Life Intelligence.

8. **Discovery is a plug-in module** — it adds surfaces and backend domain alongside the existing catalogue. With feature flags off, app behaviour must remain identical to pre-discovery. The map, event list, search, classic notifications, and check-in flows must not depend on discovery consent, Premium, or background location.

## Plug-In Isolation Rules (Non-Regression)

| Rule | Constraint |
|------|------------|
| No hot-path edits | Do not change `listEventsByBBox`, list sort order, or map fetch for discovery in P0/P1 |
| Additive schema only | New `discovery_*` tables; `user_preferences` gets notification toggles only; no `profiles` columns |
| Read-only engagement | `event_likes`, `favorites`, `event_interests`, `event_views`, `event_checkins` — read by scoring jobs, no RLS/schema changes |
| Separate location concepts | `home_location` (classic nearby notifs) ≠ `discovery_places` (inferred territory) |
| Feature flags | `EXPO_PUBLIC_DISCOVERY_ENABLED` and `EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED` default `false` |
| Funnel truth | `recommendation_events` for discovery funnel; `activity_log` extension deferred to P1+ |
| Edge Functions | New functions (`discovery-ingest`, `discovery-score`); existing `event-checkin` untouched in P0 |
| `push-dispatch` | Extension only for new notification types; existing paths unchanged |

## Consequences For Schema

New tables (all prefixed or namespaced by domain):

- `user_subscriptions`
- `discovery_consents`
- `discovery_places`
- `discovery_visits`
- `mobility_profiles`
- `discovery_profiles`
- `discovery_insights`
- `event_recommendations`
- `recommendation_events`
- `discovery_daily_summaries`

Optional supporting table:

- `discovery_location_batches` (short-lived raw upload buffer, TTL-purged)

`activity_log` may be introduced or extended for product analytics, but discovery funnel truth lives in `recommendation_events`.

## Consequences For RLS

- All `discovery_*` user tables: owner read; owner limited write (consent revoke, reaction timestamps); service_role for ingestion and scoring.
- `user_subscriptions`: owner read status summary only; writes exclusively via webhook Edge Function (service_role).
- Mobile clients must not insert visits/places directly without passing through an authenticated Edge Function that validates consent.
- Account deletion (`process_account_deletion`) must cascade purge all discovery domain data.

## Consequences For Mobile

- New module: `src/services/discovery/` (consent, capture, sync, recommendations).
- Background location requires `expo-task-manager` + platform permission flows (Always / When In Use strategy per OS).
- Discovery routes remain guarded until post-MVP release flag is enabled.
- Existing `home_location` RPC remains for classic nearby notifications; discovery places are inferred separately and must not be conflated in UX copy.

## Consequences For Notifications

Discovery notifications use separate preference columns and anti-spam rules. They must not reuse only `notify_event_nearby`.

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| Add 15 columns to `profiles` | Couples identity with volatile behavioral state; complicates GDPR deletion and RLS |
| Store everything in JSONB on `user_preferences` | Poor queryability for geo (PostGIS), scoring jobs, and audit |
| Client-side-only personalization | No cross-device profile, weak Premium control, no funnel measurement |
| Immediate full spec implementation | Too large; violates incremental delivery and MVP focus |

## References

- Functional spec: Discovery Engine v1.0 (product document, 2026)
- `project-management/roadmap/DISCOVERY_ENGINE_IMPLEMENTATION_PLAN.md`
- `project-management/roadmap/DISCOVERY_ENGINE_TICKETS.md`
- `ADR_002_MOBILE_MVP_SCOPE.md`
