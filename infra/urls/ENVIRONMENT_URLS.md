# Environment URLs — Moments Locaux

Environments are **Supabase projects**, not Git branches.  
Secrets live in Bitwarden / local `.env*` (gitignored). Templates: `.env.example`, `.env.uat.example`.

## Décision du 4 novembre 2026

Les projets **déjà actifs** deviennent la production. On ne crée pas une prod vide, on ne copie pas, on ne supprime pas.

| Rôle | Nom affiché aujourd’hui | Nom cible | Ref (ne change pas) | Région |
| --- | --- | --- | --- | --- |
| App prod | `moments-locaux-dev` | `moments-locaux-prd` | `prymkgkafaovhzopslea` | `eu-north-1` |
| Ingestion prod | `moments-locaux-ingest-dev` | `moments-locaux-ingest-prd` | `ieehuzeotwagkkprohjr` | `eu-west-1` |

L’URL reste `https://<ref>.supabase.co` tant que le domaine Auth custom n’est pas activé. Mobile, site, console et scraper qui parlent déjà à ces refs y restent. Le libellé affiché par le scraper et la console est `PRD`. `dev` reste accepté comme alias, sans changer les clés ni les variables déjà en place.

UAT et un nouveau DEV seront créés **après** ce passage, à partir de cette prod nettoyée. `ieehuzeotwagkkprohjr` est l’ingestion active : ne pas le détruire.

| Env | Supabase project name | Project ref | Region | URL |
| --- | --------------------- | ----------- | ------ | --- |
| **PROD app** | `moments-locaux-dev` → `moments-locaux-prd` | `prymkgkafaovhzopslea` | `eu-north-1` | `https://prymkgkafaovhzopslea.supabase.co` |
| **PROD ingest** | `moments-locaux-ingest-dev` → `moments-locaux-ingest-prd` | `ieehuzeotwagkkprohjr` | `eu-west-1` | `https://ieehuzeotwagkkprohjr.supabase.co` |
| **UAT / nouveau DEV** | à créer après la promotion | — | — | — |

> INGEST is the scrape warehouse only (staging / runs / occurrences). Mobile, console and site stay on the app project. Do not point the apps at the ingest ref.

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
| `development` | `development` | App prod actuelle (`prymkgkafaovhzopslea`) tant qu’un DEV neuf n’existe pas |
| `preview` | `development` | Même projet |
| `production` | `production` | Même projet : `prymkgkafaovhzopslea` |

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

- Today the sheet shows `https://prymkgkafaovhzopslea.supabase.co`.
- **Before public store release:** enable a **Supabase Auth custom domain** on this same project (e.g. `auth.moments-locaux.com`) so the sheet shows a clean brand host instead of the project ref.
- Requires Supabase plan that supports custom domains + DNS CNAME on `moments-locaux.com`.
- Native Apple Sign In does not use that sheet; Google/Facebook browser OAuth does.

Do not consider PROD “store-ready” until this is done (or explicitly accepted as known UX debt).

