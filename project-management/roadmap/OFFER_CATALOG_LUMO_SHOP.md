# Catalogue Boutique Lumo (Habitués+)

## Status

Accepted — 2026-07-26. Complète les sinks boutique de [ADR_004](../decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md). Orthogonal à [ADR_006](../decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md) (packs € Diffuseur ≠ Boutique Lumo).

## Accès

- `GAMIFICATION_ENABLED` / `EXPO_PUBLIC_GAMIFICATION_ENABLED` = true
- Entitlement Habitué **ou** Éclaireur (`hasHabitue`)
- Auth requise (guest → gate)

## Principes

1. Sink utile d’abord : **boosts + accès ≥ 70 %** des dépenses Lumo ; cosmétiques &lt; 30 %.
2. Pas de conversion Lumo → €. Pas de cash-out.
3. Pas de packs Lumo € en v1 boutique (M13 = phase 2, après calibration inflation).
4. Earn cible ~40–70 Lumo / semaine → un Boost 24h (100) ≈ 2–3 semaines d’activité.
5. Ratio earned / spent global cible **1.2–1.5**.

## Rayons UX (3 seulement)

| Rayon | Contenu |
|-------|---------|
| **Visibilité** | Boosts event + Highlight communauté |
| **Accès** | Early access + tampon Pass bonus |
| **Style** | Cadres / badges profil |

### Règles UX

- `event_boost_*` et `early_access_unlock` : **pas** de consommation one-tap depuis la liste seule → CTA « Choisir un événement » / redirection Mes événements (ou fiche event).
- Sous chaque prix : solde Lumo + estimation « ~X sorties » (basée sur `checkin_base` = 20).
- Afficher séparément les **boosts gagnés** créateur (M4) — hors catalogue payant Lumo.
- Progression Pass / Ambassadeur : visibles, **jamais vendues en €**.

## Catalogue

### Live (seed DEV actuel)

| Clé | Rayon | Titre | Prix Lumo | Effet | Notes |
|-----|-------|-------|-----------|-------|-------|
| `event_boost_24h` | Visibilité | Boost 24h | **100** | Remonte carte / liste 24h | M9 — flow event-scoped |
| `avatar_frame_local` | Style | Cadre Ambassadeur | **60** | Cadre avatar | M10 |
| `early_access_unlock` | Accès | Accès anticipé | **40** | Unlock event early | M2 — flow event-scoped |

### v1 (à seed + UX)

| Clé | Rayon | Titre | Prix Lumo | Effet | Caps / règles |
|-----|-------|-------|-----------|-------|---------------|
| `event_boost_72h` | Visibilité | Boost week-end | **240** | Remonte 72h | Max 1 boost durée / event ; compte dans cap boosts actifs user |
| `community_highlight_7d` | Visibilité | Highlight communauté | **60** | Mise en avant feed / cercle 7j | — |
| `pass_extra_stamp` | Accès | Tampon Pass bonus | **80** | +1 tampon vers Pass du mois | **1 / mois / user** |
| `avatar_frame_eclaireur` | Style | Cadre Éclaireur | **90** | Cadre avatar | Habitué+ (ou réservé Éclaireur — calibrer en UAT) |

### v2 (plus tard)

| Clé | Rayon | Titre | Prix Lumo | Effet | Caps |
|-----|-------|-------|-----------|-------|------|
| `profile_badge_season` | Style | Badge saison | **50** | Badge profil 30j | Rotation saisonnière ; pas de power-up |

### Hors boutique (affichage contextualisé)

| Mécanisme | Source | Monnaie |
|-----------|--------|---------|
| Boost créateur gagné (M4) | Check-ins sur event passé ≥ N | Crédit inventaire (pas Lumo shop) |
| Pass Habitué (M5) | 3 check-ins / mois | Progression |
| Badge Ambassadeur (M3) | Score quartier | Palier Habitué |

### Phase 2 — M13 (hors ce catalogue)

Packs IAP Lumo / boost € pour confort créateurs — **après** stabilisation économie. Ne pas mélanger avec packs € **Diffuseur** (ADR 006).

## Garde-fous économie

| Règle | Valeur |
|-------|--------|
| Cap boosts actifs simultanés / user | **2** |
| Cap `pass_extra_stamp` | **1 / mois** |
| Cosmétiques | Rotation OK ; aucun effet ranking |
| KPI % spend boosts vs cosmétique | Boosts **≥ 70 %** |
| KPI délai 1er spend | &lt; **21 jours** après 1er check-in |

## Mapping ADR 004

| ID ADR | Item boutique |
|--------|---------------|
| M9 | `event_boost_24h`, `event_boost_72h` |
| M2 | `early_access_unlock` |
| M10 | `avatar_frame_local`, `avatar_frame_eclaireur`, `profile_badge_season` |
| Highlight (sink ADR) | `community_highlight_7d` |
| M5 (accélération) | `pass_extra_stamp` |
| M13 | Packs € — phase 2, hors table |

## Implémentation (ticket SHOP-V1)

1. Seed `shop_items` v1 (`event_boost_72h`, `community_highlight_7d`, `pass_extra_stamp`, `avatar_frame_eclaireur`).
2. UX boutique : grouper par 3 rayons ; CTA event-scoped pour boosts / early access.
3. RPC / effets : durée 72h sur `active_boosts` / `boosted_until` ; highlight 7j ; grant tampon Pass avec cap mensuel.
4. Ne pas activer sur UAT/prod sans validation humaine (règle migrations).

### Migrations DEV

| Fichier | Contenu |
|---------|---------|
| `20260807_shop_v1_catalog_rayons.sql` | Seed catalogue + métadonnées rayon |
| `20260808_shop_v1_effects_caps.sql` | Effets RPC : `purchase_event_boost(event, item_key)`, `buy_item` highlight/pass, cap 2 boosts, `bonus_stamps`, views communauté |

DEV (`prymkgkafaovhzopslea`) : appliquer après validation. UAT/prod : **pas** sans OK humain.

## Related

- `project-management/decisions/ADR_004_LUMO_ECONOMY_FREEMIUM.md`
- `project-management/decisions/ADR_006_DIFFUSEUR_B2B_OFFER.md`
- `project-management/roadmap/MVP_TICKETS.md` — `SHOP-V1`, `MVP-LUMO-006`
- `app/(tabs)/shop.tsx`
- `src/services/shop.service.ts`
- Seed DEV : `supabase/migrations/20260722_lumo_economy_adr004_seed.sql`
- Effets DEV : `supabase/migrations/20260808_shop_v1_effects_caps.sql`
