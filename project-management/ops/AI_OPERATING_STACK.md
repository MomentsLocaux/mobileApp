# Stack IA opérationnelle — Moments Locaux

| Métadonnée | Valeur |
|---|---|
| **Statut** | Proposed — ops entreprise, hors MVP mobile store-ready |
| **Date** | 2026-08-17 |
| **Ticket** | Aucun ticket MVP. Doc d’exploitation post-MVP / équipe. |
| **Audience** | Fondateur, eng, product, modo, sales, CS, ops |
| **Objectif** | Un outil par job pour une équipe IA-native (~12 ETP), sans usine à SaaS |

Cette stack sert le plan d’équipe **IA-native** (3 eng, 1 product, 2 modo, 4 sales, 1 CS, 1 ops, CEO). Elle ne remplace pas les ADR produit (Lumo, Diffuseur, identité).

**Principe :** l’IA multiplie les 12 ; elle ne les remplace pas. Elle coupe surtout le middle office (code, copy, pré-modération, CRM). Elle ne signe pas un OT, ne tient pas l’astreinte seule, et ne tranche pas une fraude Pass.

---

## 1. Hors scope

- Admin modération **dans le mobile** (ADR 001) — la file modo reste la **web console**.
- Features Lumo / Habitué / Diffuseur Pro (ADR 004, 006, 007) — ce document ne change pas les tarifs ni les entitlements.
- Secrets, service role, dumps utilisateurs dans un LLM.

---

## 2. Règles GDPR / sécu (non négociables)

Aligné agent `04_gdpr_store_compliance_officer` et audits GDPR.

1. **Pas de PII dans un LLM grand public** : pas de `users.csv`, e-mails, photos, check-ins, codes Pass, contenus signalés.
2. **Contrats** : DPA + option EU / zero data retention avant tout usage prod (OpenAI, Anthropic, Mistral, outil support, CRM).
3. **Photos signalées (mineurs / CSAM)** : jamais envoyées à un LLM généraliste. Service spécialisé (PhotoDNA / prestataire trust & safety) ou process légal humain.
4. **Migrations / RLS / secrets** : un agent peut *proposer* ; un humain *applique* (règle repo : pas de migration sans validation).
5. **Promesses produit** : un agent support ne doit jamais promettre cash-out Lumo, remboursement IAP, ou cadeau IRL financé par Moments Locaux.

Outils : **1Password** pour tous les secrets. Jamais de clés dans Notion, Slack ou les prompts.

---

## 3. Socle commun (toute l’équipe)

| Outil | Job | Quand |
|---|---|---|
| **Notion** (wiki IA) | Source de vérité : ADR, tarifs, scripts sales, FAQ CS, process modo | **Maintenant** |
| **Slack** + assistant interne (Claude in Slack **ou** Dust) | Questions « c’est quoi le Pass ? » → réponse sourcée wiki | Dès 3 personnes |
| **Granola** (ou Fireflies) | CR de réunion → actions dans Notion / CRM | Dès le 1er commercial |
| **1Password** | Secrets, accès stores, Stripe, Supabase | **Maintenant** |

Sans wiki unique, chaque personne a son ChatGPT et 12 vérités produit. C’est ça qui tue le gain IA.

Budget socle : ~150–300 €/mois au début, ~1–2 k€/mois à 12 sièges (hors LLM prod).

---

## 4. Stack par métier

### 4.1 Ingé (3)

**Déjà dans le repo :** Cursor, Expo, TypeScript, Supabase, MCP Cursor (Supabase / Figma), `AGENTS.md`, ADR.

| Outil | Ce que l’IA y fait |
|---|---|
| **Cursor** + rules (`AGENTS.md`, ADR, charte UI) | Code, revues, tickets depuis une spec |
| **MCP Supabase** | Schema, RLS, diagnostics — lecture ; écriture migration = humain |
| **MCP Figma** | Design-to-code RN, pas une nouvelle charte |
| **Sentry** | DSN prévu (`EXPO_PUBLIC_SENTRY_DSN`) ; **SDK à brancher** avant store. Erreur prod → ticket + piste de fix |
| **GitHub** (Bugbot / security review) | Revue PR ; pas de merge auto sur `main` |
| **EAS** | Builds preview ; pas un outil IA, mais le goulot si on reste en hobby |

**À ne pas faire :** agent qui applique une migration UAT/prod ; agent qui commit un `.env`.

### 4.2 Product / design (1)

| Outil | Ce que l’IA y fait |
|---|---|
| **Figma** (+ IA Figma pour variants) | Variants dans la charte existante (`DESIGN.md`, `docs/CHARTER_UI_SURFACES.md`) |
| **Cursor** design-to-code | Maquette → RN, pas 40 écrans hors charte |

### 4.3 Modération (2) — web console uniquement (ADR 001)

| Outil | Ce que l’IA y fait |
|---|---|
| **File admin web** (Moderation WebConsole) | Queue humaine ; l’IA pré-trie seulement |
| **Classifieur texte** (API moderation) | Spam, hors-sujet, toxique sur commentaires / signalements |
| **Vision** (Rekognition, Hive, ou équivalent EU) | Photos d’événements (nudité, spam visuel) |
| Humain | Fraude Pass, mineurs, litige partenaire, refus éditorial |

**À ne pas faire :** envoyer une image CSAM / mineur à ChatGPT, Claude ou Gemini.

### 4.4 Sales (4)

C’est le poste que l’IA comprime le moins : elle prépare, elle ne serre pas la main d’un OT.

| Outil | Ce que l’IA y fait |
|---|---|
| **Attio** (préféré, léger) **ou HubSpot** | CRM unique ; brief compte (« OT Lyon, Free, Apidae ») |
| **Clay** | Enrichissement SIRET / site / contacts |
| **Lemlist ou Instantly** | Séquences e-mail **après** offre claire (pas 500 mails génériques mairies) |
| Enregistrement d’appels (Granola / Fireflies) | CR + next step poussés dans le CRM |

**À ne pas faire :** séquences IA sans SKU Diffuseur / Partenaire figé — brûle les comptes institutionnels.

### 4.5 CS — Customer Success (1)

Personne qui **garde** les comptes signés (Diffuseur Pro, partenaires). Pas le hunter.

| Outil | Ce que l’IA y fait |
|---|---|
| **Crisp** (léger) **ou Intercom** | Agent N1 : FAQ Pass, check-in, abo, suppression de compte |
| Base Notion / help | Réponses sourcées ; escalation humaine |

**Macros d’escalade obligatoires** (l’agent s’arrête) :

- remboursement IAP / « Lumo en euros »
- cadeau IRL promis par Moments Locaux
- suppression de compte / export GDPR (humain + process existant)
- fraude Pass / partenaire

### 4.6 Ops / finance (1)

| Outil | Ce que l’IA y fait |
|---|---|
| **Pennylane** | Rapprochements, brouillons |
| **Stripe** | Facturation Diffuseur / packs (ADR 006) — pas d’IAP Diffuseur |
| **Qonto** (ou équivalent) | Banque |
| Expert-comptable + avocat en mission | Ils **signent** ; l’IA rédige |

### 4.7 CEO

Granola + Notion + Cursor (relecture ADR / contrat). Pas de merge dans `main` en solo sur un sujet sécu.

---

## 5. Déjà dans Moments Locaux vs à acheter

| Déjà là | À mettre en place |
|---|---|
| Cursor, Expo, Supabase, MCP | Notion wiki + assistant Slack |
| Brevo (SMTP auth) — `infra/runbooks/BRAND_EMAIL_BREVO_SMTP.md` | Crisp ou Intercom |
| Sentry DSN prévu — SDK **absent** du `package.json` | Classifieurs texto / vision (file admin) |
| Stripe prévu (ADR 006, `DIFF-BILL`) | Attio/HubSpot + Clay |
| Admin modération web (ADR 001) | Pennylane, Granola, 1Password |
| RevenueCat recommandé (Discovery tickets) | — |

---

## 6. Ordre d’installation

| Phase | Quand | Quoi |
|---|---|---|
| **A — Fondations** | Maintenant (même à 1–2 personnes) | Notion (ADR + offres + FAQ), 1Password, règle PII, **Sentry SDK** |
| **B — Premier commercial** | 1er hunter | CRM + Granola + scripts d’offre Diffuseur / Partenaire dans Notion |
| **C — Lumo / Pass live** | Flag gamification + partenaire pilote | File modo + classifieurs, Crisp, macros d’escalade |
| **D — Diffuseur Pro payant** | Premier Stripe | Pennylane, playbooks CS, DPA LLM si l’agent CS voit des tickets |

Ne pas acheter Clay / Intercom / vision API au stade MVP store-ready (ADR 002).

---

## 7. Budget indicatif (équipe 12, run-rate)

| Poste | € / mois |
|---|---|
| Sièges Notion, Slack, Granola, 1Password, Cursor | 800–1 500 |
| CRM + Clay + séquence e-mail | 400–900 |
| Crisp/Intercom | 50–300 |
| LLM APIs (modo + CS + interne) | 200–800 au début ; 2–5 k à plusieurs M de MAU |
| Vision / trust & safety | 100–600 selon volume médias |
| **Total outils + IA** | **~1,5–4 k€ / mois** (hors Pennylane / Stripe fees) |

Ce poste est inclus dans les charges « legal / outils » du plan IA-native (~12 k€/mois G&A + outils, ordre de grandeur), pas dans la masse salariale.

---

## 8. Glossaire

| Terme | Sens ici |
|---|---|
| **CS** | Customer Success — onboarding et rétention des comptes B2B déjà signés |
| **PLG** | Product-led growth — le Diffuseur Free s’upgrade presque seul |
| **N1** | Premier niveau support (FAQ) ; N2 = humain |
| **DPA** | Data Processing Agreement (sous-traitant GDPR) |
| **Hunter** | Commercial qui recrute un logo ; opposé au CS |

---

## 9. Documents liés

- `project-management/decisions/ADR_001_ADMIN_MODERATION_WEB_APP.md`
- `project-management/decisions/ADR_002_MOBILE_MVP_SCOPE.md`
- `project-management/decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md`
- `project-management/decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md`
- `project-management/agents/04_gdpr_store_compliance_officer.md`
- `project-management/roadmap/POST_MVP.md`
- `AGENTS.md`
- `infra/runbooks/BRAND_EMAIL_BREVO_SMTP.md`
- `docs/CHARTER_UI_SURFACES.md`

---

## Historique

| Date | Changement |
|---|---|
| 2026-08-17 | Création. Stack IA-native ~12 ETP, règles PII, phasage A–D. |
