# ADR 005 - OT Connect (Apidae self-serve)

## Status

Accepted.

## Context

Structure / Organisateur accounts today are only `profiles.role` labels (`institutionnel` / `professionnel`). Tourism ingestion is ops-managed via scraper env vars (`APIDAE_*`). The product vision requires OTs to paste their own Apidae `projetId` + `apiKey` for free, so Moments Locaux can push their manifestations to residents without owning a national Apidae subscription.

## Decision

1. **Org entity** — Introduce `organizations` owned by a Structure/Organisateur user. Role alone is not enough for credentials.
2. **Connectors table** — `organization_connectors` stores provider=`apidae`, `projet_id`, encrypted `api_key`, status, sync metadata. Free for all eligible roles (no Lumo/paywall gate).
3. **Mobile-first UX** — Connecteurs live under Profil for `institutionnel` and `professionnel`. WebConsole ops view is out of scope for this ADR.
4. **Secrets** — API keys are encrypted before persistence (Edge Function). Clients never read plaintext keys after save. Scraper decrypts with the same app secret (service role path).
5. **Validation** — Edge `apidae-validate` calls Apidae preview (5 FMA) before activate.
6. **Ingestion** — Scraper loads active DB connectors dynamically; `source = apidae_{org_slug}`; events stay `pending` (trusted auto-publish is a follow-up).
7. **Push prefs** — Habitant preference center remains Settings → Notifications; budget/day + quiet hours + preferred category slugs extend `user_preferences`.

## Consequences

- New migrations (human-validated before apply).
- Scrapper depends on Supabase service role + `OT_CONNECTOR_ENCRYPTION_KEY`.
- Env-based Apidae sites remain as ops fallback.
- Dedup vs Datatourisme and multi-member orgs are follow-up tickets.

## Ticket IDs

- Préférences habitant (créés) : `PREF-P0-001` … `PREF-P0-003`, `PUSH-P0-001`, `PUSH-P0-002`, `PUSH-P1-001` — voir `project-management/roadmap/PREFERENCE_CENTER_TICKETS.md`
- OT Connect (à créer) : `OT-P0-001` … `OT-P0-004`
