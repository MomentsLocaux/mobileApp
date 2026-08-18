# ADR 004 - Économie Lumo, Gamification & Freemium

## Status

Accepted — 2026-07-22 (montants P0 et nommage Local → Habitué → Éclaireur validés produit).  
**Amended — 2026-07-26** : couches = engagement *personne* (voisin) ; orthogonales au rôle créateur ; pas de SKU « Organisateur Habitué+ » ; « Pro » réservé à Diffuseur Pro (ADR 006).  
**Amended — 2026-08-17** : Habitué débloque **Lumo** + **Pass Lumo** (entitlement boutiques partenaires). Plus de Pass tampon mensuel. Dual sink = Boutique Lumo (app) + Boutique Pass Lumo (SKU par partenaire). IRL **financé et honoré par le partenaire** ; ML ne rembourse pas. Caisse partenaire (QR / code 6 car.). Taux interne 20 Lumo ≈ 1 € faciale — jamais un cours public.

## Context

Moments Locaux dispose déjà d’une infra dormante (tables `wallets`, `lumo_rules`, `lumo_transactions`, `missions`, `shop_items`, `active_boosts`, RPCs `earn_lumo` / `spend_lumo` / `buy_item`, crédit check-in via Edge Function) et d’un abonnement Discovery amorcé (entitlement technique `moments_locaux_plus`, ADR 003).

Il n’existait pas de spec métier unique pour :

- ce que Lumo représente ;
- quels comportements méritent une récompense ;
- ce que l’utilisateur gagne **dans l’app** et **dans la vraie vie** ;
- comment Lumo coexiste avec l’abonnement **Éclaireur**.

Sans cette spec, réactiver shop/missions/wallet (tickets `MVP-POST-003`, `MVP-POST-004`) risque une gamification vanity (points sans débouché) ou un pay-to-win.

**Contexte amendement 2026-07-26** : le couplage implicite « Organisateur + Habitué+ » et le libellé / code `professionnel` (« Pro ») laissaient croire (a) qu’un créateur doit payer Habitué pour publier ou booster, (b) que tout organisateur est un acteur commercial. Faux : Habitué = couche voisin ; publier est gratuit à Local ; le spectre créateur inclut partage de talent et micro-vente sans bénéfice plateforme.

## Decision

1. **Nommage produit des 3 couches (Option A — territoire)** : **Local → Habitué → Éclaireur**. La monnaie s’appelle **Lumo** (carburant d’engagement, pas une couche).

2. **Lumo est une monnaie d’engagement local**, pas un jeu arcade. Elle mesure et récompense les comportements utiles au quartier (présence, création fiable, contribution utile).

3. **Toute récompense Lumo doit avoir un débouché dual** : **Boutique Lumo** (in-app : boost, early access, VIP event, cosmétique) **et Boutique Pass Lumo** (SKU IRL chez un partenaire). Les sinks purement cosmétiques restent secondaires. Mix spend cible : **45 % in-app / 35 % partenaires / 20 % cosmétique + buffer**.

4. **Pas de conversion Lumo → €. Pas de cash-out. Pas de cours public.** Un taux **interne** (20 Lumo ≈ 1 € de valeur faciale partenaire) sert uniquement à calibrer les grilles SKU. L’app affiche des prix en Lumo, jamais « 1 Lumo = x € ». Packs Lumo payants = phase 2 (M13).

5. **Éclaireur est orthogonal en *produit Discovery*** mais **incrémental en entitlements** : Éclaireur ⇒ Habitué ⇒ Local. Habitué = abo engagement : check-in, earn/spend Lumo, **Pass Lumo** (accès boutiques partenaires), Boutique Lumo. Éclaireur = profondeur Discovery + tout Habitué. L’abo Éclaireur ne doit pas créer de pay-to-win Lumo massif (au plus ×1.1 soft). Entitlements : `moments_locaux_habitue` (Habitué), `moments_locaux_plus` (Éclaireur, ex-libellé Moments Locaux+).

6. **Source de vérité backend uniquement** : crédits/débits via RPC `SECURITY DEFINER` atomiques + `lumo_rules`. Le client ne décide jamais du montant. Feature flag `GAMIFICATION_ENABLED` (défaut off tant que post-MVP).

7. **Hors MVP mobile store-ready** (ADR 002). Implémentation post-MVP uniquement.

8. **Promesse produit** : *Deviens Habitué de ton quartier. Passe Éclaireur pour découvrir encore mieux — des accès et une réputation réelle, pas juste des points.*

9. **Couches = axe personne (voisin), pas axe rôle créateur** *(amendement 2026-07-26)* : Local / Habitué / Éclaireur s’appliquent à **toute personne** qui vit le quartier, quel que soit le rôle onboarding (`particulier`, `professionnel`, `institutionnel`). Ce ne sont **pas** des upgrades « Découvreur » ni un pack « Organisateur+ ».

10. **Publier ne requiert pas Habitué** *(amendement 2026-07-26)* : création d’événement, profil créateur enrichi et boost **gagné** (M4) sont accessibles sans abo Habitué. Habitué n’est requis que pour *l’usage voisin* (check-in, earn/spend Lumo, Pass, Boutique Lumo y compris M9).

11. **Pas de SKU « Organisateur Habitué+ »** *(amendement 2026-07-26)* : un créateur peut *cumuler* Habitué s’il sort aussi dans le quartier — deux axes empilés, jamais une offre unique créateur. Copy / paywalls / analytics ne doivent pas présenter Habitué comme monétisation créateur.

12. **« Pro » réservé à Diffuseur Pro (ADR 006)** *(amendement 2026-07-26)* : le rôle `professionnel` / UI « Organisateur » n’implique pas un usage commercial. Spectre créateur hors Diffuseur : **partage de talent** (sans bénéfice) → **micro-vente** (ex. produits fait maison, hors ticketing app) → **solo régulier**. Seul **Moments Diffuseur Pro** est le SKU « Pro » commercial structure.

13. **Habitué débloque Lumo et Pass Lumo** *(amendement 2026-08-17)* : Lumo = monnaie unique. Pass Lumo = entitlement d’ouvrir les boutiques partenaires et d’y dépenser du Lumo. Ce n’est **pas** un tampon « 3 check-ins = 1 avantage ». Le streak 3 check-ins / mois crédite **+40 Lumo** une fois (M5).

14. **L’IRL est financé par le partenaire, honoré en caisse, jamais remboursé par ML** *(amendement 2026-08-17)* : l’abo 0,99 € paie la clé, pas le croissant. Achat SKU = débit Lumo + bon (`issued`, QR + code 6 car., TTL 7 j). En magasin le staff scanne / saisit via **Caisse Pass Lumo** (URL+PIN, ≠ Diffuseur) puis Valider (brûle le bon) ou Indisponible (refund Lumo). Détail : `OFFER_CATALOG_PASS_LUMO.md`.

15. **Chaque partenaire a sa boutique**, amorcée par une **grille de catégorie** (12 verticales), personnalisable ±20 % Lumo dans la bande. % toujours capés en € + panier mini. Cap IRL user **120 Lumo / mois**. Quota mensuel partenaire = son budget CAC.

16. **VIP event = sink in-app, pas magasin** *(amendement 2026-08-17)* : ~100 Lumo, orga opt-in, places limitées. Financé par l’organisateur (expérience), pas par un commerçant Pass Lumo.

## Modèle en 3 couches

```
Local (gratuit : carte, events, création, social — sans check-in)
  → Habitué (abo : check-in + Lumo + Pass Lumo + missions + Boutique Lumo)
    → Éclaireur (abo : Discovery approfondie + tout Habitué)
```

**Orthogonal au rôle créateur / structure** (ne pas fusionner dans le schéma ci-dessus) :

```
Intention publication (indépendant des couches)
  → Partage de talent | Micro-vente | Solo régulier | Acteur local (Diffuseur Free/Pro — ADR 006)
```

Phrase marketing (couches voisin) :
> Explore ton quartier → Plus tu sors, plus tu débloques → Découvre autrement.

| Couche | Nom marketing | Tagline | Rôle produit | Monétisation |
|--------|---------------|---------|--------------|--------------|
| 1 | **Local** | Explore ton quartier | Acquisition / boucle locale gratuite **personne** | Gratuit |
| 2 | **Habitué** | Plus tu sors, plus tu débloques | Engagement voisin + Lumo + **Pass Lumo** + check-in | **0,99 €/mois · 9,99 €/an** (abo) — inclut Local |
| 3 | **Éclaireur** | Découvre autrement | Depth Discovery | **2,99 €/mois · 19,99 €/an** — inclut Habitué + Local |

### Vocabulaire — ne pas confondre

| Terme | Nature | Usage |
|-------|--------|--------|
| **Local** | Couche 1 (tous les comptes) | Gratuit — sans check-in ; **création autorisée** |
| **Habitué** | Couche 2 / abo engagement **personne** | 0,99 €/mois · 9,99 €/an ; check-in / Lumo / **Pass Lumo** / Boutique Lumo — **pas** un pack créateur |
| **Lumo** | Monnaie | Earn / spend — jamais le nom d’une couche ; jamais un cours € public |
| **Pass Lumo** | Entitlement Habitué | Droit d’ouvrir les boutiques partenaires et d’y dépenser du Lumo — **pas** un tampon mensuel |
| **Boutique Pass Lumo** | Catalogue SKU / partenaire | Grille de catégorie + perso ±20 % ; bon QR 7 j |
| **Caisse Pass Lumo** | Outil staff magasin | URL+PIN ; scan / code ; Valider ou Indisponible — ≠ Diffuseur |
| **Bon SKU** | Voucher | Lumo déjà débité ; one-shot ; lié à un `partner_id` |
| **Ambassadeur** | Badge / palier *dans* Habitué (M3) | Statut quartier, pas une 4ᵉ couche |
| **Éclaireur** | Couche 3 / abo Discovery | 2,99 €/mois · 19,99 €/an ; inclut Habitué ; code = `moments_locaux_plus` |
| **Organisateur** | Rôle UI (`professionnel`) | Créateur solo — talent / micro-vente / régulier ; **≠ Pro commercial** |
| **Acteur local / Diffuseur** | Rôle + offre B2B (ADR 006) | Structure ; seul **Diffuseur Pro** porte le libellé « Pro » |
| **Boost gagné (M4)** | Crédit inventaire créateur | Débloqué par check-ins *des participants* — **sans** Habitué côté organisateur |
| **Boutique boost (M9)** | Sink Lumo | Réservé Habitué+ qui a aussi un event — sink voisin, pas SKU créateur |

## Stack minimale (5 mécanismes prioritaires)

Si une seule vague post-MVP : livrer ces 5 avant missions complexes / leaderboards nationaux.

1. Check-in → Lumo (preuve de présence)
2. Early access events
3. Statut quartier / badge Ambassadeur (palier Habitué, pas une couche)
4. Boost gagné pour créateurs (visibilité)
5. Pass Lumo — boutiques partenaires (SKU + caisse) + streak bonus Lumo

## Matrice métier

Colonnes :

- **Mécanisme** — levier CX / marketing  
- **Trigger earn / règle** — ce qui crédite Lumo (ou progression)  
- **Sink / dépense** — comment Lumo (ou le palier) se consomme  
- **Valeur in-app** — ce que l’utilisateur ressent dans l’app  
- **Valeur réelle (IRL)** — gain concret hors écran  
- **Métrique principale** — signal de succès  
- **Priorité** — vague d’implémentation  

| ID | Mécanisme | Trigger earn / règle | Sink / dépense | Valeur in-app | Valeur réelle (IRL) | Métrique principale | Priorité |
|----|-----------|----------------------|----------------|---------------|---------------------|---------------------|----------|
| M1 | Preuve de présence | Check-in geo/QR validé → +15–25 Lumo ; max 1/event/user ; cap journalier | Spend Boutique Lumo **ou** Boutique Pass Lumo | Feedback immédiat “+X Lumo” | Matière première des SKU magasin (20 L ≈ 1 € faciale) | Check-ins / user / 30j ; % users avec ≥1 spend IRL | P0 |
| M2 | Early access | Solde Lumo / badge Ambassadeur (Habitué) ou mission hebdo | Dépenser Lumo **ou** statut pour révéler event 24–48h avant public | FOMO, feed “avant tout le monde” | Place limitée, exclusivité sociale locale | Taux d’inscription early vs public ; no-show early | P0 |
| M3 | Statut quartier (badge Ambassadeur) | Score agrégé (check-ins + events tenus + contributions) sur période / zone — *palier dans Habitué* | Pas un sink monétaire ; seuil de palier | Badge profil, filtre communauté locale | Crédibilité IRL, invitations à co-organiser, confiance inscrits | Users avec badge actif ; follows / event après badge | P0 |
| M4 | Boost créateur gagné | Event passé avec N check-ins réussis (participants Habitués) → crédit boost organique | Activer boost 24–48h sur prochain event | Visibilité carte/liste **sans abo créateur** | Remplissage réel de l’événement | Taux de remplissage avant/après boost ; events avec ≥N check-ins | P0 |
| M5 | Streak de sorties | 3 check-ins distincts dans le mois (rayon / ville) | **+40 Lumo** once / mois (plus de Pass tampon) | Progression mensuelle visible | Accélère un SKU partenaire, ne le donne pas | % users atteignant streak ; rétention M1 | P0 |
| M6 | Mission daily légère | Ex. 1 favori + 1 vue détail event → +10–15 Lumo ; 1/jour | Alimente Boutique Lumo / Pass Lumo | Habitude douce sans spam | Indirect | Daily active mission completion rate | P1 |
| M7 | Mission weekly | 3 check-ins **ou** 1 event publié approuvé → +50–80 Lumo | Alimente early access / boost | Objectif semaine clair | Accès / avantages plus rapides | Weekly mission completion ; correlation check-ins | P1 |
| M8 | Contribution UGC utile | Photo / tip approuvé (modération web) → +20 Lumo | — | Crédit “photo par @x” sur l’event | Preuve sociale pour les suivants ; expo partenaires | % médias approuvés ; views sur events avec UGC | P1 |
| M9 | Boutique boost payant (Lumo) | Habitué+ **qui a aussi un event** — sink voisin, pas monétisation créateur | Spend 80–150 Lumo → `active_boosts` 24h | Contrôle ponctuel de visibilité | Plus d’inscrits IRL | Lumo spent on boosts ; ROAS remplissage | P1 |
| M10 | Cosmétiques profil | — | Spend 40–100 Lumo (cadre, badge) | Expression identitaire | Faible IRL ; OK en complément seulement | % spend cosmétique vs boost (cible cosmétique < 30%) | P2 |
| M11 | Cercles / défis collectifs | Challenge cercle mensuel (ex. 10 check-ins jazz) | Récompense collective (unlock event privé) | Appartenance, feed cercle | Apéro / event privé partenaire | Taille cercles actifs ; participation challenges | P2 |
| M12 | Parrainage voisin | Filleul actif (check-in ou event sous 14j) → +100 Lumo ; cap mensuel | — | Progression réseau | Élargissement communauté locale réelle | K-factor local ; % filleuls activés | P2 |
| M13 | Packs Lumo / boost € | Achat IAP (phase 2 seulement) — **confort Habitué**, pas SKU « créateur Pro » | Crédit wallet ou boost direct | Confort spend sans farm | Visibilité payante assumée | ARPU Habitué ; inflation Lumo post-IAP | Phase 2 |
| M14 | VIP event | Event orga opt-in + quota places | Spend ~100 Lumo | Accès palier VIP | Expérience IRL **financée par l’orga**, pas ML | Conversion VIP ; no-show VIP | P0 |
| M15 | Boutique Pass Lumo | Habitué+ ; SKU partenaire (grille catégorie) | Spend Lumo → bon QR 7 j → caisse | Choix magasin | Avantage IRL **financé par le partenaire** | % Lumo spent IRL ; redemptions / quota partenaire | P0 |

### Visibilité créateur — qui paie quoi *(amendement 2026-07-26)*

| Levier | Qui en bénéficie | Prérequis Habitué côté organisateur ? | Monnaie |
|--------|------------------|----------------------------------------|---------|
| Publication / profil enrichi | Talent, micro-vente, solo régulier, Acteur local | **Non** | — |
| Boost gagné (M4) | Tout créateur après N check-ins *participants* | **Non** | Crédit inventaire |
| Boutique boost (M9) | Compte Habitué+ qui publie aussi | **Oui** (sink Habitué) | Lumo |
| Packs / abo Diffuseur | Acteur local (ADR 006) ; upsell solo si quotas / sièges | **Non** | € web |
| Packs Lumo € (M13, phase 2) | Habitué confort | **Oui** (toujours Habitué+) | IAP — ≠ packs Diffuseur |

### Montants indicatifs (à calibrer via `lumo_rules`)

| Trigger `lumo_rules` | Amount | Caps / anti-abus |
|----------------------|--------|------------------|
| `checkin` | 15–25 | 1 / event / user ; cooldown journalier global |
| `streak_monthly` | 40 | 1 / mois calendaire si ≥3 check-ins distincts |
| `mission_daily` | 10–15 | 1 / jour UTC user |
| `mission_weekly` | 50–80 | 1 / semaine |
| `event_published_approved` | 40–60 | 1–2 / semaine |
| `media_approved` | 20 | Après modération only |
| `referral_activated` | 100 | Cap mensuel |

| Sink shop / action | Coût Lumo | Effet |
|--------------------|-----------|-------|
| Boost event 24h | 80–150 | Puits in-app |
| Early-bird unlock | 30–50 | Accès anticipé |
| VIP event (M14) | ~100 | Palier orga opt-in |
| SKU Pass Lumo (M15) | 20–220 selon grille | Bon magasin, financé partenaire |
| Cadre / badge profil | 40–100 | Cosmétique |
| Highlight communauté 7j | 60 | Social |

**Équilibre cible :** user actif moyen ~40–70 Lumo / semaine gagnés (~200 / mois) ; cap IRL **120 Lumo / mois**. Mix spend **45 % in-app / 35 % Pass Lumo / 20 % cosmétique + buffer**. Ratio earned/spent global cible **1.2–1.5**. Un croissant partenaire = 40 Lumo = 2 check-ins. Un VIP = ~2 semaines.

## Financement et caisse Pass Lumo *(amendement 2026-08-17)*

Détail : `project-management/roadmap/OFFER_CATALOG_PASS_LUMO.md`.

**Qui paie**

| Quoi | Qui paie | Ce que ça donne |
|------|----------|-----------------|
| 0,99 € / mois | L’utilisateur | Le droit de gagner et dépenser des Lumo — **pas** le cadeau magasin |
| Lumo | Personne — ça se gagne | 20 Lumo par check-in, etc. |
| Croissant / remise | **Le commerçant** | Le cadeau. **Moments Locaux ne rembourse jamais.** |
| VIP sur un event | L’organisateur (la place) | Dans l’app, pas en magasin |
| Être plus visible dans l’app | Le commerçant, plus tard, s’il veut | **Pas obligatoire** pour offrir des cadeaux |

Le commerçant choisit combien de cadeaux par mois. Compteur plein → « plus de cadeaux ce mois-ci ».

**En magasin**

QR du commerce à la caisse. Le client scanne, choisit l’offre. Les Lumo sont mis de côté 90 secondes.

- **Cadeau** (croissant) : il montre l’écran. Le commerçant donne l’article sans le facturer.
- **Remise** (sport, resto) : le commerçant enlève **5 €** (pas un % tout seul) sur **son** ticket, puis appuie sur le téléphone du client. Là seulement les Lumo sont dépensés. S’il n’appuie pas : Lumo rendus.

Pas d’appli commerçant. Pas de bon acheté à la maison.

## Anti-patterns (non-objectifs)

- Points sans débouché IRL  
- Leaderboard national / mondial  
- Quêtes spam (like N posts, ouvrir l’app N jours)  
- Achat de Lumo trop tôt (casse la confiance “j’ai vraiment gagné”)  
- Premium qui multiplie fortement les gains Lumo (pay-to-win)  
- Crédit Lumo décidé côté client mobile  
- **SKU / copy « Organisateur Habitué+ »** ou paywall créateur qui exige Habitué pour publier *(amendement 2026-07-26)*  
- **Présenter Habitué comme monétisation créateur** (M9 = sink voisin optionnel, M4 = levier organique) *(amendement 2026-07-26)*  
- **Appeler « Pro » un Organisateur / talent / micro-vente** — « Pro » = Diffuseur Pro uniquement (ADR 006) *(amendement 2026-07-26)*  
- Mélanger packs € Diffuseur et Boutique / packs Lumo  
- **Rembourser un partenaire pour un SKU honoré** ou vendre Habitué comme « 1 € = 6 € de cadeaux ML » *(amendement 2026-08-17)*  
- Afficher un cours public Lumo → €  
- % magasin sans cap €  
- Encaisser du Lumo au comptoir  
- Faire installer une appli au commerçant (un QR imprimé suffit)  
- Une remise en % sans plafond en euros, ou sans tap du commerçant sur le téléphone du client  
- Garder un Pass tampon mensuel à côté des SKU Lumo *(amendement 2026-08-17)*  

## Conséquences techniques

### Réutiliser

- `lumo_rules`, `lumo_transactions`, `wallets`  
- RPCs `earn_lumo`, `spend_lumo`, `buy_item`  
- `shop_items`, `user_inventory`, `active_boosts`  
- Edge Function `event-checkin` (à refactor pour crédit atomique via RPC, pas double écriture manuelle)  
- `user_subscriptions` + entitlement Éclaireur / `moments_locaux_plus` (ADR 003)  

### Ajouter / formaliser (post-MVP)

- Feature flag `GAMIFICATION_ENABLED` / `EXPO_PUBLIC_GAMIFICATION_ENABLED`  
- Métadonnées de caps sur `lumo_rules` (ou table `lumo_rule_caps`)  
- Idempotence crédits : contrainte unique `(user_id, source, item_type, item_id)` quand pertinent  
- Paliers statut quartier (table ou vue `user_local_status`)  
- Partenaires / Pass : `partners` + offres + bons 90 s. QR magasin (deep link). RPCs : choisir l’offre (Lumo mis de côté), confirmer cadeau / tap commerçant « j’enlève X € », libérer au timeout.  
- RLS : wallet & transactions owner-only ; pas d’exposition publique `lumo_total` tant que gamification non assumée  

### Tickets liés

- `MVP-POST-003` — missions / gamification  
- `MVP-POST-004` — wallet / Lumo  
- `MVP-POST-002` (shop/offers) — sinks boutique & boosts  

Branche recommandée doc/impl : `feat/post-mvp-wallet-lumo` puis `feat/post-mvp-gamification`.

## Légal & store

- Ne pas promettre monnaie virtuelle / boosts / IAP dans les CGU **avant** activation réelle du flag.  
- Quand activé : section CGU dédiée (pas de cash-out, nature virtuelle, perte possible à suppression compte selon politique).  
- Partenaires IRL : contrat (SKU, quota, le partenaire finance, anti-fraude, TTL). Copy store : prix en Lumo only.  
- Ne jamais écrire qu’un Lumo a une valeur en euros pour l’utilisateur.  

## KPIs globaux

| KPI | Cible indicative |
|-----|------------------|
| Users avec ≥1 check-in / 30j | À définir par ville |
| Ratio Lumo earned / spent | 1.2–1.5 |
| Délai medián 1er spend Lumo | < 21 jours après 1er check-in |
| Conversion Local → Éclaireur | Funnel Discovery (ADR 003) |
| Activation Habitué (≥1 earn Lumo / 30j) | Engagement couche 2 |
| % spend in-app / Pass Lumo / cosmétique | 45 / 35 / 20 |
| Cap IRL respecté | ≤ 120 Lumo / user / 30j |
| Taux honorer vs « indisponible » partenaire | Suivi ; abus → pause boutique |
| Signal abus (multi-check-in, farm, double scan) | Alerte + caps |

## Consequences

### Positive

- Spec unique pour product, engagé, backend et admin web.  
- Aligne gamification sur la promesse “quartier réel”.  
- Évite de réactiver du code dormant sans règles.  
- *(2026-07-26)* Clarifie que Lumo/Habitué ne monétisent pas la création ; préserve les usages talent / micro-vente hors “Pro”.

### Negative / risques

- Dépendance partenaires locaux pour la valeur IRL (sans partenaires, M1/M5 s’affaiblissent).  
- Complexité anti-fraude check-in / parrainage.  
- Calibration économique itérative obligatoire.  
- *(2026-07-26)* Risque UX de re-coller Habitué aux écrans créateur (boutique boost) — copy et gates à surveiller.

### Follow-ups

1. ~~`MVP-LUMO-001` — accepter cet ADR~~ **Done 2026-07-22**.  
2. ~~`MVP-LUMO-002` — seed DEV~~ **Done 2026-07-22** sur `moments-locaux-dev` ; UAT/prod en attente validation.  
3. ~~`MVP-LUMO-003` / `004` — RPC atomiques + refactor `event-checkin`~~ **Done 2026-07-22 on DEV**.  
4. ~~`MVP-LUMO-005`…`006` — missions + boost~~ **Done 2026-07-22 on DEV**.  
5. ~~`MVP-LUMO-007` — Ambassadeur / statut quartier~~ **Done 2026-07-22 on DEV**.  
6. Branches en attente de merge : `feat/post-mvp-lumo-early-access` (009), `feat/post-mvp-lumo-ux-011` (011), `feat/post-mvp-lumo-remaining-010-008-012` (010 + 008 partiel + 012).  
7. `MVP-LUMO-008` **rewrite 2026-08-17** : boutiques Pass Lumo + bons SKU + caisse partenaire (plus de Pass tampon).  
8. Seed / flags UAT–prod.  
9. *(2026-07-26)* Aligner copy boutique / paywalls créateur sur décisions 9–12 (pas d’exigence Habitué pour publier ; M9 contextualisé « voisin qui publie »).  
10. *(2026-07-26)* Optionnel : amendement miroir ADR 006 + ticket rename UI Organisateur → Créateur (enum `professionnel` conservé).  
11. ~~*(2026-07-26)* Mettre à jour `OFFER_CATALOG_LUMO_SHOP.md`~~ + **2026-08-17** `OFFER_CATALOG_PASS_LUMO.md`.  

Note: `MVP-LUMO-009` early access est sur branche `feat/post-mvp-lumo-early-access` (DEV appliqué) — **pas mergé main** tant que non validé.  

### Live DEV snapshot (2026-07-22, post-seed)

| code | trigger | amount | active |
|------|---------|--------|--------|
| `checkin_base` | `checkin` | 20 | true |
| `mission_daily` | `mission_daily` | 12 | true |
| `mission_weekly` | `mission_weekly` | 60 | true |
| `event_published_approved` | `event_published_approved` | 50 | true |
| `media_approved` / `referral_activated` | … | 20 / 100 | false |
| `MISSION_DAILY` / `CONTEST_WIN` | legacy | 150 / 1200 | false |

Shop ADR (seed live) : `event_boost_24h` (100), `avatar_frame_local` skin (60) ; early access `early_access_unlock` (40).  
Catalogue boutique in-app : `project-management/roadmap/OFFER_CATALOG_LUMO_SHOP.md` — ticket `SHOP-V1`.  
Catalogue Pass Lumo (financement + caisse + 12 grilles) : `project-management/roadmap/OFFER_CATALOG_PASS_LUMO.md` — ticket `MVP-LUMO-008`.  
Missions ADR : Sortie du jour (12), Week-end local (60).

RPC live : `earn_lumo(p_amount int, p_reason text, p_metadata jsonb)`, `spend_lumo(p_amount int, p_item_type text, p_item_id uuid, p_metadata jsonb)`, `buy_item(p_item_key text)`.

**Frontière B2B** : packs € / abo **Moments Diffuseur** = ADR 006 — **orthogonal** à cette économie Lumo. Compte Professionnel **sans** Habitué/Lumo (ADR 007 : compte Particulier séparé pour découvrir).

**Frontière rôle créateur** *(amendement 2026-07-26)* : Habitué / Éclaireur restent des couches **personne**. Un Organisateur (talent, micro-vente, solo) ou Acteur local peut les cumuler pour *son* usage voisin — jamais comme condition de publication ni comme libellé d’offre créateur. Renommage UI éventuel `Organisateur` → `Créateur` = ticket produit / `DIFF-RENAME` cousin ; enum `professionnel` inchangé tant que non décidé.

### Amendment log

| Date | Changement |
|------|------------|
| 2026-07-26 | Décisions 9–12 : couches = axe personne ; publier sans Habitué ; pas de SKU Organisateur Habitué+ ; « Pro » = Diffuseur Pro. Matrice M4/M9/M13 + table leviers visibilité. Anti-patterns naming. |
| 2026-08-17 | Décisions 13–16 : Pass Lumo entitlement ; IRL financé partenaire + caisse URL+PIN ; grilles catégorie ; VIP in-app. M1/M5/M14/M15. Plus de Pass tampon. |

## Related

- `ADR_002_MOBILE_MVP_SCOPE.md` — hors MVP  
- `ADR_003_DISCOVERY_ENGINE_DOMAIN.md` — Éclaireur / entitlement `moments_locaux_plus` orthogonal  
- `ADR_006_DIFFUSEUR_B2B_OFFER.md` — offre B2B Professionnel / Diffuseur (orthogonal Lumo)  
- `ADR_007_ACCOUNT_IDENTITY_MODES.md` — Particulier vs Professionnel ; modes B2C  
- `project-management/roadmap/OFFER_CATALOG_LUMO_SHOP.md` — catalogue Boutique Lumo  
- `project-management/roadmap/OFFER_CATALOG_PASS_LUMO.md` — boutiques partenaires, financement, caisse  
- `project-management/roadmap/POST_MVP.md`  
- `project-management/roadmap/MVP_TICKETS.md` (`MVP-POST-002`…`004`, `MVP-LUMO-001`…`012`, `SHOP-V1`, `ID-*`, `DIFF-*`)  
- `supabase/diagnostics/20260721_lumo_rules_seed_proposal.sql`  
- `MVP_SCOPE.md`  
- `audits/standalone-audits/RLS_AUDIT.md` (wallets / lumo)  
