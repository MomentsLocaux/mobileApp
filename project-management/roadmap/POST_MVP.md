# Post-MVP

Phased against mobile feature flags (`src/config/features.ts`). See ADR_002 Amendment 2026-07-29 and `MVP_SCOPE.md`.

## V1 (flags off in MVP — flip when ready)

- `FEATURE_EVENT_CREATE` — création mobile, mes events, ModeSwitch.
- `FEATURE_EVENT_SUGGEST` — suggestion catalogue depuis une affiche (LLM vision → formulaire prérempli → confirm utilisateur). **Découplé de `FEATURE_EVENT_CREATE`**. Pas de Vision API. Insert `pending` + `creator_id` système. Lumo : crédit silencieux à l’approbation modo ; wallet UI reste V2.
- `FEATURE_CHECKIN` — QR / géoloc.
- `FEATURE_OFFERS` — Nos offres / Habitué–Éclaireur (IAP).
- `FEATURE_DIFFUSEUR` — Professionnel + packs / analytics.
- Contact discovery (optionnel) — scan carnet via `expo-contacts`, match hash email/téléphone **opt-in** (jamais requis à l’inscription), UX consentement GDPR. MVP garde uniquement le share link.

## V2 / plus tard

### Boutique / Lumo / Missions (`FEATURE_GAMIFICATION`)

- Shop.
- Purchase flows (Lumo).
- Produits premium / cosmétiques.
- Catalogue étendu : `project-management/roadmap/OFFER_CATALOG_LUMO_SHOP.md`
- Ticket : `SHOP-V1` dans `MVP_TICKETS.md`
- Missions, Pass quartier, wallet / transactions.

### Discovery / Concours

- Discovery Engine (`FEATURE_DISCOVERY`).
- Contests (`FEATURE_CONTESTS`).

### Offres / identité (détail)

- Subscriptions B2C : Local → Habitué → Éclaireur (ADR 004).
- **Moments Diffuseur** (B2B) : ADR_006 ; identité ADR_007.
- Tickets B2B : `DIFF-J0` (wire-up DEV app + console + liste d’attente), `DIFF-ORG`, `DIFF-PRO`, `DIFF-BILL` ; identité : `ID-ONBOARD`, `ID-MODE-SWITCH`, `ID-GUARDS`

### Web hors MVP produit

- Portail partenaires / création web (console modération + vitrine restent MVP).
- Analytics avancés, offline, ML trust.
- Stack IA opérationnelle (équipe ~12, outils par métier) : `project-management/ops/AI_OPERATING_STACK.md`

## Principe

Ces sujets peuvent rester dans le repo comme code dormant seulement s'ils sont invisibles, guardés (feature flags + redirects) et sans risque RLS/store. Ils ne doivent pas être exposés dans le mobile MVP.
