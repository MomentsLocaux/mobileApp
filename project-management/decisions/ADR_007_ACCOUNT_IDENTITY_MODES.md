# ADR 007 - Identité compte : B2C modes vs B2B Diffuseur

## Status

Accepted — 2026-07-26 (décisions produit : jamais créateur pur ; découverte = B2C only ; gamme pro unique).

## Context

L’onboarding actuel propose trois rôles exclusifs (`particulier` / `professionnel` / `institutionnel`) qui **mélangent** « qui je suis » et « ce que je fais ». Un particulier est libellé Découvreur ; seuls pro / institutionnel ouvrent le parcours créateur. Il n’existe pas de mode UI Découvreur ↔ Créateur, ni de séparation nette B2C / B2B.

Les offres B2C (ADR 004) et B2B Diffuseur (ADR 006) exigent une identité de compte cohérente avant toute refonte repo / DB.

## Decision

### 0. Nommage — une seule distinction de premier niveau

**Produit / onboarding (ce que l’utilisateur voit)** :

```
Étape 1 — Qui êtes-vous ?
├─ Particulier
└─ Professionnel
     └─ Étape 1b — Quel type de professionnel ?
          ├─ Indépendant
          ├─ Association
          ├─ Lieu
          ├─ Office de tourisme
          └─ Collectivité
```

| Niveau | Termes autorisés | Termes **interdits** en UI |
|--------|------------------|----------------------------|
| 1 — Audience | **Particulier**, **Professionnel** | Structure, Institutionnel, Organisateur (comme 3ᵉ/4ᵉ carte) |
| 2 — Sous Professionnel | Indépendant, Association, Lieu, Office de tourisme, Collectivité | Traiter « institutionnel » comme un frère de « professionnel » |

**Technique (legacy → cible)** :

| Legacy DB / code | Statut | Remplacement |
|------------------|--------|--------------|
| `particulier` | Conservé comme `account_kind` | — |
| `professionnel` | Devient `account_kind=professionnel` + subtype (souvent `independant`) | Plus le seul « orga solo » opposé à Structure |
| `institutionnel` | **Déprécié comme audience** | Toujours `account_kind=professionnel` + un subtype (`collectivite`, `association`, `lieu`, `office_tourisme`…) |

`institutionnel` ne doit **plus** apparaître comme choix d’onboarding ni comme label badge grand public. Migration douce : backfill subtype puis arrêt d’écriture de la valeur legacy.

### 1. Axe audience (étape 1 onboarding)

| Choix | Nature | Compte |
|-------|--------|--------|
| **Particulier** | B2C | Compte personne |
| **Professionnel** | B2B | Compte activité / org → offre **Moments Diffuseur** (ADR 006) + **sous-type obligatoire** |

### 2. B2C — jamais créateur pur

Tout compte **Particulier** est **toujours Découvreur** (carte, fil, favoris, check-in Habitué, Lumo, etc.).

À l’onboarding (multi-select d’intention, ou équivalent) :

| Intention | Capacités | UI |
|-----------|-----------|-----|
| **Découvrir uniquement** | `can_discover` ; **pas** `can_create` | Teinte **Découvreur** ; création d’événements **désactivée / masquée** |
| **Découvrir + créer** | `can_discover` + `can_create` | **Switch** Découvreur ↔ Créateur ; teinte selon mode actif |

**Interdit** : compte B2C « créateur seulement » (sans découverte).

Le switch n’apparaît que si `can_create`. Activer la création plus tard (settings) reste possible sans changer d’audience.

### 3. Découverte = B2C uniquement

Un compte **Professionnel (B2B)** **n’a pas** de mode Découvreur, ni Habitué / Éclaireur / Boutique Lumo / check-in participant sur ce compte.

Si la personne veut découvrir / check-in / Lumo : elle crée un **compte Particulier séparé** (email distinct ou parcours multi-compte ultérieur). Pas de « double casquette » sur le même compte pro au lancement.

### 4. Typologie Professionnel (sous-types, pas des audiences)

Après « Professionnel », **étape obligatoire** de typologie (même grille Diffuseur Free + Pro + packs) :

| Valeur technique `pro_subtype` | Libellé UI | Exemples |
|--------------------------------|------------|----------|
| `independant` | Indépendant | Coach, artisan, DJ, créateur solo |
| `association` | Association | Club, asso de quartier |
| `lieu` | Lieu | Salle, café-concert, musée, médiathèque |
| `office_tourisme` | Office de tourisme | OT, CDT |
| `collectivite` | Collectivité | Mairie, CCAS, EPCI |

Usages / modules peuvent différer (Apidae, badge officiel…) ; **pas** de catalogues prix distincts au démarrage (ADR 006).

Ancien libellé « Structure » / rôle `institutionnel` = **réparti** dans ces sous-types (souvent Collectivité, Association, Lieu ou OT) — plus jamais un 3ᵉ bouton d’audience.

### 5. Couleurs UI (B2C)

Trois teintes dédiées (tokens à définir en design system) :

| Contexte | Teinte |
|----------|--------|
| Découvreur seul | Couleur **Découvreur** |
| Mode Découvreur (si switch) | Couleur **Découvreur** |
| Mode Créateur (si switch) | Couleur **Créateur B2C** |

B2B Diffuseur : teinte **Professionnel** distincte (hors switch B2C) — une teinte famille pro, éventuellement modulée légèrement par `pro_subtype` plus tard.

### 6. Hors MVP store-ready

Refonte onboarding + flags + switch + thème = **post-MVP** (ADR 002). Spec Accepted maintenant pour éviter de coder Habitué / Diffuseur sur le mauvais modèle d’identité.

## Modèle logique

```
account_kind: particulier | professionnel
  particulier:
    can_discover: always true
    can_create: false | true
    active_mode: discover | create   # create seulement si can_create
  professionnel:
    can_discover: false
    can_create: true
    pro_subtype: independant | association | lieu | office_tourisme | collectivite   # obligatoire
    diffuseur_plan: free | pro       # ADR 006
```

**Ne pas** stocker `institutionnel` comme `account_kind`. Champ legacy `profiles.role = institutionnel` = dette à migrer.

Mapping transition depuis l’existant (indicatif) :

| Legacy `profiles.role` | Cible produit |
|------------------------|---------------|
| `particulier` | `account_kind=particulier`, `can_create=false` (ou true si déjà créateur de fait) |
| `professionnel` | `account_kind=professionnel`, `pro_subtype=independant` (sauf info contraire) |
| `institutionnel` | `account_kind=professionnel`, `pro_subtype` à choisir / backfill (collectivité, asso, lieu, OT…) |
| `invite` / admin / modo | inchangés (hors modèle grand public) |

Source de vérité produit : **`account_kind` + `pro_subtype` + flags** — pas le trio legacy particulier/professionnel/institutionnel.

## Frontières offres

| | Compte Particulier (B2C) | Compte Professionnel (B2B) |
|--|--------------------------|----------------------------|
| Découverte / Habitué / Éclaireur / Lumo | Oui | **Non** |
| Création d’événements | Si `can_create` | Oui (Diffuseur) |
| Switch modes | Si `can_create` | Non |
| Offre € | IAP Habitué / Éclaireur | Diffuseur Free / Pro / packs (web) |

## Impacts repo / DB (carte, pas implémentation)

| Surface | Changement |
|---------|------------|
| Onboarding | Étape audience → intentions B2C ou subtype B2B |
| Navigation / FAB / Mes événements | Guard `can_create` + `active_mode` |
| Thème / chrome | Tokens selon mode / account_kind |
| `profiles` | Colonnes ou table dérivée : kind, flags, mode, subtype |
| RLS / publish | Basé sur `can_create` / membership org, pas seulement `role IN (…)`) |
| WebConsole | Filtres B2C vs B2B ; plus de label « Structure » isolé |
| Auth multi-compte | V1 = deux comptes séparés ; deep-link « créer mon compte Découvreur » depuis un compte pro |

## Anti-patterns

- Créateur B2C sans découverte.
- Mode Découvreur / Lumo / check-in sur compte Professionnel.
- Gammes tarifaires Diffuseur différentes par subtype au lancement.
- **3 cartes d’onboarding** Particulier / Professionnel / Institutionnel (ou Structure) — Institutionnel n’est **pas** une audience.
- Utiliser « Organisateur » ou « Acteur local » comme substitut d’audience à la place de **Professionnel**.
- Implémenter le switch sans guards création (fuite UX).

## Conséquences

### Positive

- Discours simple : Particulier vs Professionnel, puis typologie pro.
- Fin de la confusion Structure / institutionnel / professionnel au même niveau.
- Identité alignée avec Diffuseur (ADR 006) et Habitué (ADR 004).

### Negative / risques

- Refonte large (nav, thème, onboarding, RLS).
- Friction multi-compte pour les pros qui veulent aussi sortir (assumée V1).
- Migration / dépréciation de `institutionnel` à planifier (backfill `pro_subtype`).

## Tickets liés

- `ID-ONBOARD` — audience Particulier/Professionnel + `pro_subtype` (plus de carte Structure)
- `ID-MODE-SWITCH` — switch Découvreur ↔ Créateur + teintes
- `ID-GUARDS` — masquage création si `!can_create`
- `DIFF-ORG` — orgs / sièges alignés Professionnel + subtype

## Related

- `ADR_002_MOBILE_MVP_SCOPE.md`
- `ADR_004_LUMO_ECONOMY_FREEMIUM.md` — offres B2C only sur compte Particulier
- `ADR_006_DIFFUSEUR_B2B_OFFER.md` — offres B2B ; gamme unique ; subtypes sous Professionnel
- `src/screens/onboarding/OnboardingScreen.tsx` — **aujourd’hui** 3 rôles legacy à remplacer
- `src/utils/roleHelpers.ts` — labels Structure / Organisateur à retirer du grand public
