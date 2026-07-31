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

## Public web URLs (site + admin) — target

One Git repo per app; environment is chosen by **env files / EAS**, not by separate mobile repos.

| Env | Site vitrine | Console admin | Mobile points to |
| --- | ------------ | ------------- | ---------------- |
| **DEV** | `https://dev.moments-locaux.com` | `https://admin.dev.moments-locaux.com` | Supabase DEV |
| **UAT** | `https://staging.moments-locaux.com` | `https://admin.staging.moments-locaux.com` | Supabase UAT |
| **PROD** | `https://moments-locaux.com` | `https://admin.moments-locaux.com` | Supabase PROD |

Other TLDs (`.fr` / `.app` / `.net`) redirect to **PROD** only.

Mobile does **not** load via those hostnames. It uses Supabase URLs + deep link scheme `moments-locaux://`.  
Optional public links inside the app (`EXPO_PUBLIC_APP_SHARE_URL`, QR web base) should match the env above once DNS is live.

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
| `moments-locaux://auth/callback` | Site URL + OAuth / email confirm |
| `moments-locaux://auth/reset-password` | Password recovery deep link |
| `moments-locaux://**` | Wildcard deep links |
| `exp://**` | Expo Go / local Metro |

Password recovery is enabled with Email provider (default). Custom SMTP required for reliable delivery.

See runbook: `infra/runbooks/BRAND_EMAIL_BREVO_SMTP.md` (Brevo domain + Supabase SMTP + brand checklist).

## PROD reminder — Auth UX (iOS OAuth sheet)

iOS shows the **real Auth host** in the system dialog  
(“MomentsLocaux souhaite utiliser …”).

- Today (DEV/UAT): ugly `https://<project-ref>.supabase.co` — acceptable for internal testing.
- **Before public / store PROD:** enable a **Supabase Auth custom domain** (e.g. `auth.moments-locaux.com`) so the sheet shows a clean brand host instead of the project ref.
- Requires Supabase plan that supports custom domains + DNS CNAME on `moments-locaux.com`.
- Native Apple Sign In does not use that sheet; Google/Facebook browser OAuth does.

Do not consider PROD “store-ready” until this is done (or explicitly accepted as known UX debt).

