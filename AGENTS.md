# Moments Locaux - Agentic Operating Rules

## Project Context

Moments Locaux is an Expo / React Native / TypeScript mobile app backed by Supabase. The current objective is to prepare a clean, reliable, store-ready mobile MVP.

The repository contains:

- audit files under `audits/`
- consolidated roadmap files under `project-management/roadmap/`
- ADRs under `project-management/decisions/`
- reusable agent role prompts under `project-management/agents/`

## Non-Negotiable Product Decision

Admin moderation is not part of the mobile MVP.

Admin moderation will be handled in a separate web admin app. The mobile app keeps only user-facing mechanisms:

- report an event
- report a comment
- report a profile/user
- view creator publication statuses: `draft`, `pending`, `published`, `refused`, `archived`
- view refusal reason when available
- delete account
- access CGU and privacy policy
- access support/contact when needed

The mobile app must not expose:

- admin dashboard
- moderation queues
- approve/reject actions
- ban/warn/lift restriction actions
- media review admin
- user risk dashboard

## General Rules

- Always read `project-management/decisions/ADR_001_ADMIN_MODERATION_WEB_APP.md` and `project-management/decisions/ADR_002_MOBILE_MVP_SCOPE.md` before acting.
- Always identify the ticket being worked on before modifying anything.
- 1 ticket = 1 branch = 1 controlled diff = 1 review.
- Never introduce a new feature outside the MVP scope.
- Prefer hiding or guarding non-MVP routes before deleting large areas of code.
- Do not remove existing files unless explicitly requested and justified by a ticket.
- Do not modify migrations or Supabase files unless the ticket explicitly belongs to the Supabase Security Architect scope.
- Never apply a Supabase migration without human validation.
- Never execute destructive SQL.
- Never delete data without human validation.
- Never expose a service role key or other sensitive secret.
- Avoid unrelated refactors.
- Keep changes small, testable and tied to acceptance criteria.

## Verification Rules

After any applicative code change, run:

```bash
npm run typecheck
npm run lint
```

For config/release changes, also run:

```bash
npx expo config
```

For documentation-only changes, do not run app builds unless explicitly requested.

## Required Inputs Before Ticket Work

Read at minimum:

- `project-management/roadmap/MVP_TICKETS.md`
- `project-management/roadmap/P0_BLOCKERS.md`
- `project-management/roadmap/MVP_ACTION_PLAN.md`
- `project-management/decisions/ADR_001_ADMIN_MODERATION_WEB_APP.md`
- `project-management/decisions/ADR_002_MOBILE_MVP_SCOPE.md`
- `MVP_SCOPE.md`

Then read the audit files referenced by the ticket.

## Branch Strategy

Recommended branches:

- `chore/audit-consolidation`
- `fix/p0-navigation-scope`
- `fix/p0-auth-onboarding`
- `fix/p0-event-lifecycle`
- `fix/p0-env-config`
- `fix/p0-gdpr-minimum`
- `fix/p0-supabase-rls`
- `fix/p0-database-integrity`
- `fix/p1-media-storage`
- `fix/p1-map-search`
- `fix/p1-error-handling`
- `fix/p1-build-release`

## Agent Roles

- Coordinator: `project-management/agents/00_coordinator.md`
- Product Owner MVP: `project-management/agents/01_product_owner_mvp.md`
- UX/UI Guardian: `project-management/agents/02_ux_ui_guardian.md`
- Supabase Security Architect: `project-management/agents/03_supabase_security_architect.md`
- GDPR / Store Compliance Officer: `project-management/agents/04_gdpr_store_compliance_officer.md`
- Mobile Reliability Engineer: `project-management/agents/05_mobile_reliability_engineer.md`
- QA Lead: `project-management/agents/06_qa_lead.md`
- Release Manager: `project-management/agents/07_release_manager.md`

## Final Response Standard

At the end of any mission, report:

- ticket handled
- files modified
- verification commands run and results
- remaining risks
- follow-up tickets or decisions needed
