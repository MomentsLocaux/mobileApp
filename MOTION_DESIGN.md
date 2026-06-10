# Motion Design

Ce document décrit les choix d’animation de l’application. Aucune modification visuelle (couleurs, typo, icônes, contenus) — uniquement le mouvement.

## Tokens centralisés

Fichier : `src/constants/motion.ts`

- **Durées** : `micro` (120 ms), `fast` (180 ms), `normal` (260 ms), `slow` (380 ms), `screen` (480 ms)
- **Easing** : `standard`, `emphasized` (entrées), `exit` (sorties)
- **Springs** : `soft` (press / micro-feedback), `snappy` (cards actives), `sheet` (bottom sheet carte)
- **Transforms** : scales de press, marqueur sélectionné, entrée card / bouton
- **Distances** : translateY pour preview, contenu, liste, CTA
- **Stagger** : 50 ms (contenu détail), 30 ms (liste)

Helpers : `createEnterTiming`, `createExitTiming`, `createStandardTiming`.

## Accessibilité

`src/hooks/useReduceMotion.ts` lit `AccessibilityInfo.isReduceMotionEnabled()`. Quand activé, les animations sont court-circuitées (état final immédiat).

## Composants réutilisables

| Composant | Rôle |
|-----------|------|
| `MotionReveal` | Fade + translateY avec délai optionnel |
| `FloatingPressable` | Entrée scale/fade + feedback press au tap |

## Parcours carte (discovery)

| Zone | Animation |
|------|-----------|
| **Marqueurs** (`MapWrapper`) | Pulse scale léger à la sélection (~1.08), spring snappy, zIndex relevé |
| **Preview card** (`MapEventUnitOverlay`) | Entrée : translateY 80, opacity, scale 0.96 → 1 ; sortie inverse, ~180 ms |
| **Carte fond** (`map.tsx`) | Opacity 1 → 0.92 selon progression sheet ; refit caméra synchronisé à la fin du resize layout |
| **Bottom sheet** (`SearchResultsBottomSheet`, `map-sheet-layout`) | Pan au doigt, spring `Motion.spring.sheet`, snaps peek (72 px) → half (55 %) → full (92 %) ; depuis half, scroll vers le haut en tête de liste élargit vers full |
| **Liste** (`EventResultCard`) | Stagger 30 ms sur les 4 premières cards, press scale |
| **Boutons flottants** (`FloatingPressable` sur map) | Fade + scale entrée, press 0.94 |

## Fiche détail (`EventDetailScreen`)

1. Hero en premier (`MotionReveal` delay 0)
2. Boutons header (`FloatingPressable`, stagger 40 ms)
3. Titre puis blocs info (stagger 50 ms)
4. CTA sticky : translateY 80 → 0, delay ~180 ms après ouverture

## Overlays recherche

`SearchBar` et `MapFiltersSheet` : expansion depuis l’ancre, durées alignées sur `Motion` (entrée emphasized, sortie exit).

## UI générique

- `Button` : press scale via spring soft
- `Card` : press scale interactif, tokens motion

## Principes

- Animations sur le **UI thread** (Reanimated) autant que possible
- Pas de bounce cartoon, pas de rotation décorative
- Chaque élément semble venir de son emplacement logique (bas → haut pour sheets/cards, expansion depuis la sélection pour le détail)
- La logique métier et l’identité visuelle restent inchangées

## Vérification

```bash
npx tsc --noEmit
```

Tester manuellement sur iOS et Android : sélection marqueur, preview, expansion liste, navigation vers détail, retour, reduce motion dans les réglages système.
