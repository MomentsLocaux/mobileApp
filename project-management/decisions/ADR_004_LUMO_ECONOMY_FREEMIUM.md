# ADR 004 - Économie Lumo, Gamification & Freemium

## Status

Proposed.

## Context

Moments Locaux dispose déjà d’une infra dormante (tables `wallets`, `lumo_rules`, `lumo_transactions`, `missions`, `shop_items`, `active_boosts`, RPCs `earn_lumo` / `spend_lumo` / `buy_item`, crédit check-in via Edge Function) et d’un abonnement Discovery amorcé (entitlement technique `moments_locaux_plus`, ADR 003).

Il n’existait pas de spec métier unique pour :

- ce que Lumo représente ;
- quels comportements méritent une récompense ;
- ce que l’utilisateur gagne **dans l’app** et **dans la vraie vie** ;
- comment Lumo coexiste avec l’abonnement **Éclaireur**.

Sans cette spec, réactiver shop/missions/wallet (tickets `MVP-POST-003`, `MVP-POST-004`) risque une gamification vanity (points sans débouché) ou un pay-to-win.

## Decision

1. **Nommage produit des 3 couches (Option A — territoire)** : **Local → Habitué → Éclaireur**. La monnaie s’appelle **Lumo** (carburant d’engagement, pas une couche).

2. **Lumo est une monnaie d’engagement local**, pas un jeu arcade. Elle mesure et récompense les comportements utiles au quartier (présence, création fiable, contribution utile).

3. **Toute récompense Lumo doit avoir un débouché dual** : valeur in-app **et** valeur réelle (accès, économie, statut, remplissage d’événement). Les sinks purement cosmétiques sont secondaires.

4. **Pas de conversion Lumo → €.** Pas de cash-out. Les packs Lumo payants sont reportés en phase 2 après stabilisation de l’économie.

5. **Éclaireur est orthogonal à Lumo / Habitué** (ADR 003) : Éclaireur = profondeur Discovery / confort ; Habitué + Lumo = engagement événementiel. L’abo ne doit pas créer d’avantage compétitif massif en Lumo (au plus ×1.1 soft ou missions exclusives non pay-to-win). Entitlement technique inchangé : `moments_locaux_plus` (ex-libellé Moments Locaux+).

6. **Source de vérité backend uniquement** : crédits/débits via RPC `SECURITY DEFINER` atomiques + `lumo_rules`. Le client ne décide jamais du montant. Feature flag `GAMIFICATION_ENABLED` (défaut off tant que post-MVP).

7. **Hors MVP mobile store-ready** (ADR 002). Implémentation post-MVP uniquement.

8. **Promesse produit** : *Deviens Habitué de ton quartier. Passe Éclaireur pour découvrir encore mieux — des accès et une réputation réelle, pas juste des points.*

## Modèle en 3 couches

```
Local (gratuit : carte, events, création, check-in, social)
  → Habitué (engagement : Lumo, missions, Pass, statut quartier)
    → Éclaireur (abonnement IAP : Discovery approfondie)
```

Phrase marketing :
> Explore ton quartier → Plus tu sors, plus tu débloques → Découvre autrement.

| Couche | Nom marketing | Tagline | Rôle | Monétisation |
|--------|---------------|---------|------|--------------|
| 1 | **Local** | Explore ton quartier | Acquisition / boucle locale gratuite | — |
| 2 | **Habitué** | Plus tu sors, plus tu débloques | Engagement + Lumo + sinks utiles (Pass, early access, boosts) | Soft currency Lumo ; boosts créateurs phase 2 en € |
| 3 | **Éclaireur** | Découvre autrement | Depth Discovery (My Radius, Right Now avancé, Break the Loop…) | 2,99 €/mois · 19,99 €/an (indicatif) |

### Vocabulaire — ne pas confondre

| Terme | Nature | Usage |
|-------|--------|--------|
| **Local** | Couche 1 (tous les comptes) | Par défaut, sans abo ni progression Habitué mise en avant |
| **Habitué** | Couche 2 / programme d’engagement | UX missions, wallet Lumo, Pass, progression |
| **Lumo** | Monnaie | Earn / spend uniquement — jamais le nom d’une couche |
| **Ambassadeur** | Badge / palier *dans* Habitué (M3) | Statut quartier, pas une 4ᵉ couche |
| **Éclaireur** | Couche 3 / abo | Libellé UI paywall & profil ; code = `moments_locaux_plus` |

## Stack minimale (5 mécanismes prioritaires)

Si une seule vague post-MVP : livrer ces 5 avant missions complexes / leaderboards nationaux.

1. Check-in → tampon / Pass partenaire  
2. Early access events  
3. Statut quartier / badge Ambassadeur (palier Habitué, pas une couche)  
4. Boost gagné pour créateurs (visibilité)  
5. Streak de sorties mensuel (pas streak de login)

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
| M1 | Preuve de présence | Check-in geo/QR validé → +15–25 Lumo ; max 1/event/user ; cap journalier | Accumulation vers Pass / tampon partenaire | Feedback immédiat “+X Lumo · tampon” | Réduction, café offert, file prioritaire, goodie partenaire | Check-ins / user / 30j ; % check-ins → Pass débloqué | P0 |
| M2 | Early access | Solde Lumo / badge Ambassadeur (Habitué) ou mission hebdo | Dépenser Lumo **ou** statut pour révéler event 24–48h avant public | FOMO, feed “avant tout le monde” | Place limitée, exclusivité sociale locale | Taux d’inscription early vs public ; no-show early | P0 |
| M3 | Statut quartier (badge Ambassadeur) | Score agrégé (check-ins + events tenus + contributions) sur période / zone — *palier dans Habitué* | Pas un sink monétaire ; seuil de palier | Badge profil, filtre communauté locale | Crédibilité IRL, invitations à co-organiser, confiance inscrits | Users avec badge actif ; follows / event après badge | P0 |
| M4 | Boost créateur gagné | Event passé avec N check-ins réussis → crédit boost organique (ou Lumo dédiés créateur) | Activer boost 24–48h sur prochain event | Visibilité carte/liste | Remplissage réel de l’événement | Taux de remplissage avant/après boost ; events avec ≥N check-ins | P0 |
| M5 | Streak de sorties | 3 check-ins distincts dans le mois (rayon / ville) | Déblocage Pass week-end (auto ou spend symbolique) | Progression mensuelle visible | Pass partenaires week-end / apéro offert | % users atteignant streak ; rétention M1/M2 | P0 |
| M6 | Mission daily légère | Ex. 1 favori + 1 vue détail event → +10–15 Lumo ; 1/jour | Alimente M1/M2 | Habitude douce sans spam | Indirect (accélère Pass) | Daily active mission completion rate | P1 |
| M7 | Mission weekly | 3 check-ins **ou** 1 event publié approuvé → +50–80 Lumo | Alimente early access / boost | Objectif semaine clair | Accès / avantages plus rapides | Weekly mission completion ; correlation check-ins | P1 |
| M8 | Contribution UGC utile | Photo / tip approuvé (modération web) → +20 Lumo | — | Crédit “photo par @x” sur l’event | Preuve sociale pour les suivants ; expo partenaires | % médias approuvés ; views sur events avec UGC | P1 |
| M9 | Boutique boost payant (Lumo) | — | Spend 80–150 Lumo → `active_boosts` 24h | Contrôle créateur sur la visibilité | Plus d’inscrits IRL | Lumo spent on boosts ; ROAS remplissage | P1 |
| M10 | Cosmétiques profil | — | Spend 40–100 Lumo (cadre, badge) | Expression identitaire | Faible IRL ; OK en complément seulement | % spend cosmétique vs boost (cible cosmétique < 30%) | P2 |
| M11 | Cercles / défis collectifs | Challenge cercle mensuel (ex. 10 check-ins jazz) | Récompense collective (unlock event privé) | Appartenance, feed cercle | Apéro / event privé partenaire | Taille cercles actifs ; participation challenges | P2 |
| M12 | Parrainage voisin | Filleul actif (check-in ou event sous 14j) → +100 Lumo ; cap mensuel | — | Progression réseau | Élargissement communauté locale réelle | K-factor local ; % filleuls activés | P2 |
| M13 | Packs Lumo / boost € | Achat IAP (phase 2 seulement) | Crédit wallet ou boost direct | Confort créateurs pro | Visibilité payante assumée | ARPU créateur ; inflation Lumo post-IAP | Phase 2 |

### Montants indicatifs (à calibrer via `lumo_rules`)

| Trigger `lumo_rules` | Amount | Caps / anti-abus |
|----------------------|--------|------------------|
| `checkin` | 15–25 | 1 / event / user ; cooldown journalier global |
| `mission_daily` | 10–15 | 1 / jour UTC user |
| `mission_weekly` | 50–80 | 1 / semaine |
| `event_published_approved` | 40–60 | 1–2 / semaine |
| `media_approved` | 20 | Après modération only |
| `referral_activated` | 100 | Cap mensuel |

| Sink shop / action | Coût Lumo | Effet |
|--------------------|-----------|-------|
| Boost event 24h | 80–150 | Puits principal |
| Early-bird unlock (si payant Lumo) | 30–50 | Accès anticipé |
| Cadre / badge profil | 40–100 | Cosmétique |
| Highlight communauté 7j | 60 | Social |

**Équilibre cible :** user actif moyen ~40–70 Lumo / semaine gagnés ; un boost ≈ 2–3 semaines d’activité. Ratio earned/spent global cible **1.2–1.5**.

## Anti-patterns (non-objectifs)

- Points sans débouché IRL  
- Leaderboard national / mondial  
- Quêtes spam (like N posts, ouvrir l’app N jours)  
- Achat de Lumo trop tôt (casse la confiance “j’ai vraiment gagné”)  
- Premium qui multiplie fortement les gains Lumo (pay-to-win)  
- Crédit Lumo décidé côté client mobile  

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
- Partenaires / Pass : modèle `partner_rewards` + redemption (admin web)  
- RLS : wallet & transactions owner-only ; pas d’exposition publique `lumo_total` tant que gamification non assumée  

### Tickets liés

- `MVP-POST-003` — missions / gamification  
- `MVP-POST-004` — wallet / Lumo  
- `MVP-POST-002` (shop/offers) — sinks boutique & boosts  

Branche recommandée doc/impl : `feat/post-mvp-wallet-lumo` puis `feat/post-mvp-gamification`.

## Légal & store

- Ne pas promettre monnaie virtuelle / boosts / IAP dans les CGU **avant** activation réelle du flag.  
- Quand activé : section CGU dédiée (pas de cash-out, nature virtuelle, perte possible à suppression compte selon politique).  
- Partenaires IRL : contrat simple (valeur, durée, anti-fraude redemption).  

## KPIs globaux

| KPI | Cible indicative |
|-----|------------------|
| Users avec ≥1 check-in / 30j | À définir par ville |
| Ratio Lumo earned / spent | 1.2–1.5 |
| Délai medián 1er spend Lumo | < 21 jours après 1er check-in |
| Conversion Local → Éclaireur | Funnel Discovery (ADR 003) |
| Activation Habitué (≥1 earn Lumo / 30j) | Engagement couche 2 |
| % spend Lumo sur boosts vs cosmétique | Boosts ≥ 70% |
| Signal abus (multi-check-in, farm) | Alerte + caps |

## Consequences

### Positive

- Spec unique pour product, engagé, backend et admin web.  
- Aligne gamification sur la promesse “quartier réel”.  
- Évite de réactiver du code dormant sans règles.

### Negative / risques

- Dépendance partenaires locaux pour la valeur IRL (sans partenaires, M1/M5 s’affaiblissent).  
- Complexité anti-fraude check-in / parrainage.  
- Calibration économique itérative obligatoire.

### Follow-ups

1. `MVP-LUMO-001` — accepter cet ADR (Proposed → Accepted).  
2. `MVP-LUMO-002` — seed proposé : `supabase/diagnostics/20260721_lumo_rules_seed_proposal.sql` (**ne pas appliquer sans validation humaine**).  
3. `MVP-LUMO-003` / `004` — RPC atomiques + refactor `event-checkin`.  
4. `MVP-LUMO-005`…`011` — missions, shop boost, statut, Pass IRL, early access, UX flag.  
5. `MVP-LUMO-012` — CGU / store à l’activation.  

### Live DEV snapshot (2026-07-21)

Règles actuelles avant recalibrage ADR :

| code | trigger | amount | active |
|------|---------|--------|--------|
| `checkin_base` | `checkin` | 5 | true |
| `MISSION_DAILY` | `mission_complete` | 150 | true (inflationnaire) |
| `CONTEST_WIN` | `contest_win` | 1200 | true (hors P0) |

RPC live : `earn_lumo(p_amount int, p_reason text, p_metadata jsonb)`, `spend_lumo(p_amount int, p_item_type text, p_item_id uuid, p_metadata jsonb)`, `buy_item(p_item_key text)`.

## Related

- `ADR_002_MOBILE_MVP_SCOPE.md` — hors MVP  
- `ADR_003_DISCOVERY_ENGINE_DOMAIN.md` — Éclaireur / entitlement `moments_locaux_plus` orthogonal  
- `project-management/roadmap/POST_MVP.md`  
- `project-management/roadmap/MVP_TICKETS.md` (`MVP-POST-002`…`004`, `MVP-LUMO-001`…`012`)  
- `supabase/diagnostics/20260721_lumo_rules_seed_proposal.sql`  
- `MVP_SCOPE.md`  
- `audits/standalone-audits/RLS_AUDIT.md` (wallets / lumo)  
