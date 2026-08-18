# ADR 006 - Offre B2B Moments Diffuseur (ex-« Structure »)

## Status

Accepted — 2026-07-26 (hybride Free + Pro + packs).  
Amendé — 2026-07-26 : **pas de quota publications** ; **découverte hors compte pro** (ADR 007) ; **gamme unique** tous subtypes ; **nommage** Particulier/Professionnel puis `pro_subtype` (plus d’audience Institutionnel).

## Context

L’onboarding legacy propose **trois** rôles au même niveau (`particulier` / `professionnel` / `institutionnel` = « Structure »). C’est incorrect : Institutionnel n’est **pas** une audience, c’est un **type de Professionnel**. ADR 007 fixe Particulier | Professionnel, puis typologie.

La monétisation B2C (ADR 004) clarifie aussi : **découverte = compte Particulier seulement**.

Parallèlement :

- OT / Apidae = connecteur **gratuit** (flywheel contenu) ;
- WebConsole **Partenaires Pass Lumo** (boutiques SKU + caisse) ≠ comptes Diffuseur ;
- pas encore d’orgs / sièges / entitlements B2B en base.

## Decision

1. **Nom commercial** : **Moments Diffuseur**.
2. **Audience** : uniquement **Professionnel** (ADR 007). Legacy « Organisateur » et « Structure » / `institutionnel` → **`pro_subtype`** sous Professionnel — **interdit** comme 3ᵉ bouton d’onboarding.
3. **Gamme unique** : **Diffuseur Gratuit** + **Diffuseur Pro** + **packs ponctuels** (€). Même prix pour tous les `pro_subtype` ; modules / copy peuvent varier.
4. **Pas d’IAP mobile** — facturation web / Stripe / devis.
5. **Pas de quota de publications** (aligné B2C). Différenciation Free/Pro = sièges, crédibilité, analytics, crédits boost, priorité modération, modules.
6. **Pas de découverte / Habitué / Lumo sur le compte pro** — compte Particulier séparé si besoin (ADR 007).
7. **Frontière Lumo** : Boutique Lumo = Habitué+ B2C only. Packs Diffuseur = € B2B only.
8. **Hors MVP** mobile store-ready (ADR 002). Lots `DIFF-*` / `ID-*`.

### Promesse produit

> Diffusez vos moments locaux — gratuit pour démarrer, Pro pour scaler l’équipe et la portée.

Copy par vertical (même SKU Pro) :

| `pro_subtype` | Accroche |
|---------------|----------|
| Indépendant | Publiez vos dates, mesurez qui vient vraiment. |
| Association | Remplissez vos ateliers, sans devenir une plateforme. |
| Office de tourisme | Diffusez Apidae localement, mesurez la présence réelle. |
| Collectivité | L’agenda de proximité, vérifié et suivi. |
| Lieu | Remplissez la salle, week-end après week-end. |

## Vocabulaire — ne pas confondre

| Terme | Nature | Usage |
|-------|--------|--------|
| **Particulier** | Audience B2C (niveau 1) | Onboarding |
| **Professionnel** | Audience B2B (niveau 1) | Onboarding — **seul** parent des typologies |
| **`pro_subtype`** | Typologie sous Professionnel | Indépendant, Association, Lieu, OT, Collectivité |
| **Moments Diffuseur** | Famille d’offre B2B | Free / Pro / packs |
| **`institutionnel` / Structure** | Legacy | Migrer → Professionnel + subtype ; **interdit** en UI niveau 1 |
| **Partenaire Pass Lumo** | Boutiques IRL (SKU + caisse) | Admin + Caisse URL+PIN — ≠ Diffuseur. Le partenaire **finance** le SKU. |

## Modèle hybride

```
Diffuseur Gratuit
  → Diffuseur Pro (abo €)
  → Packs ponctuels (€) — Free et Pro
```

### Diffuseur Gratuit

| Capacité | Gratuit |
|----------|---------|
| Profil org enrichi | Oui |
| Publications | **Illimitées** (même règle éditoriale / modération que B2C) |
| Sièges | **1** |
| OT Apidae self-serve | **Oui** si subtype OT (flywheel) |
| Stats basiques (vues / inscrits / check-ins sur *ses* events) | Oui |
| Badge non vérifié | Oui |
| Multi-sièges / priorité modération / crédits boost / export / analytics avancées | Non |

### Diffuseur Pro

Prix indicatif : **29 € HT / mois** ou **290 € HT / an** (−17 %).  
Devis annuel possible (collectivités / OT) — **mêmes entitlements**.

Canal : portail web. Le mobile **consomme** les entitlements.

| Capacité | Pro |
|----------|-----|
| Publications | Illimitées |
| Sièges | **5** (admin / éditeur) |
| Crédits boost | **2 × Boost 24h / mois** (non cumulables > 2 mois) |
| Priorité file modération | Oui (SLA soft) |
| Badge **Vérifié** | Oui (validation manuelle admin) |
| Analytics | Tableau 30/90j + top catégories + taux check-in |
| Early-access slots | 2 events / mois marqués early |
| Support | Email dédié |

### Packs ponctuels (€)

| Pack | Prix indicatif | Contenu | Notes |
|------|----------------|---------|-------|
| Boost Express | 9 € | 1× Boost 24h | Tous |
| Week-end fort | 24 € | 1× Boost 72h + Highlight 7j | Asso / lieu / indépendant |
| Campagne quartier | 79 € | 3× Boost 24h + 1 Highlight + pin carte 7j | OT / collectivité |
| Siège extra | 6 € / mois | +1 siège | Pro only |

**Supprimé** : pack « Quota +10 » (plus de quota publications).

Orthogonal à ADR 004 / M13 (packs Lumo € phase 2).

## Modules par vertical (même grille tarifaire)

| Module | Indépendant | Asso | OT | Collectivité | Lieu |
|--------|-------------|------|----|--------------|------|
| Apidae / sync agenda | — | — | **Gratuit** | Option | — |
| Agenda territoire (multi-POI) | — | — | Pro | Pro | — |
| Multi-users (sièges) | Pro (si besoin) | Pro fort | Pro | Pro | Pro |
| Badge « Officiel » / ville | — | — | Pro | **Pro + vérif** | — |
| Events récurrents | Pro | Pro | Pro | Pro | **Pro fort** |
| Early-access culturel | — | — | — | — | Pro |
| Export open-data / bilan | — | — | Pro | **Pro** | — |

## Frontière B2C vs B2B

| | Compte Particulier (ADR 007) | Compte Professionnel / Diffuseur |
|--|------------------------------|----------------------------------|
| Qui | Habitants (+ créateurs locaux optionnels) | Orgas / structures |
| Découverte / Habitué / Lumo | Oui | **Non** (compte perso séparé) |
| Monnaie offre | Lumo + IAP Habitué/Éclaireur | € abo + packs |
| Canal | Mobile IAP | Web B2B |
| Objectif | Engagement / présence | Portée / équipe / crédibilité |

Catalogue Boutique Lumo : `project-management/roadmap/OFFER_CATALOG_LUMO_SHOP.md`.  
Catalogue Pass Lumo (financement + caisse) : `project-management/roadmap/OFFER_CATALOG_PASS_LUMO.md`.  
Identité comptes : `ADR_007_ACCOUNT_IDENTITY_MODES.md`.

## Impacts techniques (phasés)

| Lot | Contenu |
|-----|---------|
| **Doc** | ADR 006 + 007 + catalogue boutique |
| **SHOP-V1** | Boutique Lumo étendue (B2C) |
| **ID-ONBOARD** / **ID-MODE-SWITCH** | ADR 007 |
| **DIFF-ORG** | Orgs / sièges + RLS (**sans** compteurs quota publish) |
| **DIFF-PRO** | Entitlements Pro + crédits boost |
| **DIFF-BILL** | Stripe + packs |

### Règles techniques

- Onboarding niveau 1 = **Particulier | Professionnel** uniquement ; typologie = `pro_subtype` (ADR 007).
- Déprécier écritures `role=institutionnel` ; backfill → Professionnel + subtype.
- Pas de multi-tenant org complet avant Pro payant.
- OT Apidae = ADR_005 — Free pour `office_tourisme`.
- Pas d’IAP Diffuseur.

### Schéma cible (indicatif)

- `account_kind` + `pro_subtype` + flags (ADR 007).
- `organizations`, `organization_members` (sièges).
- Entitlements `moments_locaux_diffuseur_pro`.
- Crédits boost B2B + ledger packs €.
- **Pas** de compteur quota mensuel publications.

## Anti-patterns

- Quotas publications Free/Pro alors que B2C n’en a pas.
- Quatre+ tarifs Pro par vertical au lancement.
- Découverte / Lumo sur compte Professionnel.
- Vendre Diffuseur en IAP mobile.
- Mélanger packs € Diffuseur et Boutique Lumo.
- Confondre Partenaire Pass Lumo et Diffuseur. Le partenaire n’a pas besoin d’un compte Diffuseur pour honorer un bon.
- Garder « Structure » / `institutionnel` comme audience au même niveau que Professionnel.

## Conséquences

### Positive

- Gamme pro simple à vendre et à expliquer.
- Cohérence avec B2C sur le volume de publication.
- Séparation nette des comptes perso / pro.

### Negative / risques

- Friction multi-compte pour les pros qui sortent aussi (assumée V1, ADR 007).
- Sièges / RLS org = complexité à phaser.
- Badge Vérifié = dépendance ops admin.

## Tickets liés

`MVP_TICKETS.md` : `SHOP-V1`, `DIFF-ORG`, `DIFF-PRO`, `DIFF-BILL` + tickets identité ADR 007.

## Related

- `ADR_001_ADMIN_MODERATION_WEB_APP.md`
- `ADR_002_MOBILE_MVP_SCOPE.md`
- `ADR_004_LUMO_ECONOMY_FREEMIUM.md`
- `ADR_007_ACCOUNT_IDENTITY_MODES.md`
- `project-management/roadmap/OFFER_CATALOG_LUMO_SHOP.md`
- `project-management/roadmap/POST_MVP.md`
- `src/screens/onboarding/OnboardingScreen.tsx`
- `src/utils/roleHelpers.ts`
