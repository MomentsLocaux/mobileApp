# Secrets allowlist / denylist (SEC-003 / SCRUM-237)

Public values may live in the Expo / Vite / Next **client** bundle. Everything else stays in Edge Functions, EAS secrets, or server env.

## Allowlist (bundle OK)

| Name | Where |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | mobile `extra` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile `extra` (public by design; protection = RLS) |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | mobile — **public** `pk.` token only |
| `EXPO_PUBLIC_SENTRY_DSN` | mobile |
| `EXPO_PUBLIC_FEATURE_*` / share URL / bucket names | mobile |
| `VITE_SUPABASE_URL_*` / `VITE_SUPABASE_ANON_KEY_*` | moderation console |
| `VITE_MAPBOX_TOKEN` | console — `pk.` only |
| `NEXT_PUBLIC_SITE_URL` | marketing site |

## Denylist (never `EXPO_PUBLIC_` / `VITE_` extra / `app/` `src/`)

| Name | Where it must live |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions, scrapper, website server actions |
| `OPENAI_API_KEY` | Edge Functions, scrapper |
| `SUBSCRIPTION_WEBHOOK_SECRET` | Edge webhooks |
| Mapbox `sk.` / `MAPBOX_SECRET` / `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | native build env / EAS, never `extra` |

`VITE_SCRAPER_MONITOR_TOKEN` is a **local monitor Bearer**. It must not be a production secret; keep the monitor on `127.0.0.1`.

## Guard

- `app.config.ts` calls `assertNoPublicSecrets` (name **and** value shapes).
- `npm run check:secrets` scans env + `app/` `src/` `app.config.ts` `eas.json`.
