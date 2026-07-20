# Git & environments (DEV / UAT)

## Principle

**One codebase, two (later three) backends.**  
Git carries **code + migrations**. Supabase projects carry **data + secrets**. You do **not** maintain a separate Git repo or long-lived fork per environment.

```text
feature/*  →  main
                 │
                 ├─ apply migrations → Supabase DEV  (local .env)
                 └─ promote same SHA → Supabase UAT  (EAS preview / .env.uat)
```

## Recommended workflow (2 envs today)

| Branch | Role |
| ------ | ---- |
| `feature/*` | Work in progress |
| `main` | Intégration stable — source de vérité |

Optional later (when CI is ready):

| Branch | Role |
| ------ | ---- |
| `uat` | Release candidate figé pour QA TestFlight |
| `main` | Prod (when PROD exists) |

Until then: **`main` = code à déployer sur DEV et UAT**.  
You choose the env via **env files / EAS secrets**, not by branching for every change.

## What goes to which Supabase

| Change type | Where |
| ----------- | ----- |
| Migrations SQL | Applied to DEV first, then UAT (`db push` / migrate per project) |
| Edge Functions | Deployed per project (`supabase functions deploy --project-ref …`) |
| App config (URL, keys) | `.env` = DEV ; `.env.uat` + EAS Secrets profile `preview` = UAT |
| Feature flags | Prefer env vars (`EXPO_PUBLIC_*`) per env |

## Rules

1. Never commit `.env` / `.env.uat`.
2. Never put `service_role` in mobile or admin bundles.
3. Schema changes land in `supabase/migrations/` once; replay on each project.
4. Do not “fix UAT only” by editing the UAT dashboard schema manually without a migration.

## Day-to-day

```bash
# Local DEV (default)
cp .env.example .env   # already filled for DEV

# Point mobile at UAT when testing against UAT
# Expo loads `.env` (DEV) by default; `.env.local` overrides it.
#   npm run dev:uat    # copies .env.uat → .env.local then starts Metro
#   npm run dev:dev    # removes .env.local, back to DEV
# Verify logs show: env: load .env.local .env  and URL ieehuzeotwagkkprohjr
# After switch: log out / clear app data (AsyncStorage keeps the old session).
```

EAS UAT build: `eas build --profile preview` (secrets must target UAT).
