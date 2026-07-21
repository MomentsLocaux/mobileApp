# Environment URLs — Moments Locaux

Environments are **Supabase projects**, not Git branches.  
Secrets live in Bitwarden / local `.env*` (gitignored). Templates: `.env.example`, `.env.uat.example`.

| Env | Supabase project name | Project ref | Region | URL |
| --- | --------------------- | ----------- | ------ | --- |
| **DEV** | `moments-locaux-dev` | `prymkgkafaovhzopslea` | `eu-north-1` | `https://prymkgkafaovhzopslea.supabase.co` |
| **UAT** | `moments-locaux-uat` | `ieehuzeotwagkkprohjr` | `eu-west-1` | `https://ieehuzeotwagkkprohjr.supabase.co` |
| **PROD** | _(later)_ | — | — | — |

> UAT schema cloned from live DEV (2026-07-20): tables/functions/triggers/RLS/buckets/cron/edge functions. No user data copied.

## Local files (per repo)

| File | Env | Committed? |
| ---- | --- | ---------- |
| `.env` | DEV (default local) | No |
| `.env.uat` | UAT (copy from `.env.uat.example`) | No |
| `.env.example` / `.env.uat.example` | Templates only | Yes |

## Mobile EAS profiles

| Profile | `APP_ENV` | Backend |
| ------- | --------- | ------- |
| `development` | `development` | DEV |
| `preview` | `uat` | UAT |
| `production` | `production` | PROD (later) |

## Keys per env (Bitwarden)

For each of DEV / UAT store: Project URL, `anon`, `service_role`, DB password.

## Push dispatch (`app_config`)

After migration `20260722_push_dispatch_multi_env.sql`, run the matching ops script:

- DEV: `supabase/ops/app_config/dev.sql`
- UAT: `supabase/ops/app_config/uat.sql`

See `infra/runbooks/PUSH_NOTIFICATIONS.md`.

## Auth redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

| Value | Purpose |
| --- | --- |
| `momentslocaux://auth/callback` | Site URL + OAuth / email confirm |
| `momentslocaux://auth/reset-password` | Password recovery deep link |
| `exp://**` | Expo Go / local Metro |

Password recovery is enabled with Email provider (default). Custom SMTP required for reliable delivery.
