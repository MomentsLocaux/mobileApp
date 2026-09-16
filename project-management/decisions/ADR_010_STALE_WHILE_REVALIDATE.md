# ADR 010 - Stale-while-revalidate discovery

## Status

Accepted — 2026-09-16 (SCRUM-259 follow-on: Airbnb-style discovery paint).

## Context

Discovery is the mobile MVP (ADR 002). Users already see event cards on Home, map pins, and
covers. Opening a fiche or cold-starting the map still waited on the network (`getEventById`,
map hide-until-ready, Home skeleton) even when that payload was already on the phone.

Ad-hoc caches (Home RAM 2 min, viewport 4 keys, preview LRU 120) evicted each other. A list
cover URI could be replaced by a different media URL on enrich, remounting the hero.

## Decision

Client discovery follows three testable laws:

1. **Paint stale.** If a snapshot or a seeded event exists, the UI paints it immediately.
   Skeleton, `BrandLogoSpinner`, and the map bootstrap mask are forbidden in that case.
   A loader is allowed only on first install or after an explicit cache wipe.
2. **Enrich without unmounting.** `getEventById` merges into EventCache. A non-empty
   `cover_url` / `media.url` is never replaced by `null` or by a different URI. The hero
   keeps the same image `source` when the bytes were already on screen.
3. **Same bytes everywhere.** List cover and fiche hero use the same URI for a single photo.
   Downscale happens at decode time, not by swapping CDN URLs.

EventCache is the client source of truth (`id → EventWithCreator`), RAM + disk via
`persistStorage`. Visible Home cards, the opened event, and the map sheet list are pinned so
a 1500-pin viewport ingest cannot evict them.

Screen snapshots (last Home feed ids, last map camera/pins/sheet ids) survive process death.
Cold start paints those snapshots, then refreshes silently.

## Consequences

- Home / map / favorites / proposals push from the already-known object (seed at first render).
- Map tab shows yesterday’s pins without the 1.8 s hide-until-ready mask when a snapshot exists.
- `expo-image` (`memory-disk`) is the cover pipeline; React Native `Image` remains the fallback
  until the native module is linked.
- Admin moderation and event creation stay out of scope (ADR 001 / ADR 002).
