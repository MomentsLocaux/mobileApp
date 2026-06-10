# MapScreen — orchestration des flows

Ce document décrit la machine d’état implicite de l’écran carte (`app/(tabs)/map.tsx`) et des hooks extraits.

## États principaux

### Store `useMapResultsUIStore`

| Champ | Valeurs | Signification |
|-------|---------|---------------|
| `sheetStatus` | `browsing` \| `loading` \| `viewportResults` \| `singleEvent` | État bottom sheet / chargement |
| `bottomSheetIndex` | 0, 1, 2 | Snap peek / half (55 %) / full (92 %) |
| `sheetEvents` | `EventWithCreator[]` | Liste affichée dans la sheet |
| `frozenViewport` | snapshot \| null | Copie figée des résultats quand viewport locké |
| `activeEventId` | string \| undefined | Marker / card surligné |

### Refs viewport (non-React)

| Ref | true quand… |
|-----|-------------|
| `viewportFrozenRef` | Sheet expandée (index ≥ 1) ou marker freeze actif |
| `isProgrammaticMoveRef` | Mouvement caméra déclenché par le code |
| `suppressBoundsRecalcUntilRef` | Fenêtre temporelle : ignorer `onVisibleBoundsChange` |

---

## 1. Chargement initial du viewport

```
Map ready / focus screen
  → ensureInitialViewportLoad()
  → getVisibleBounds (retry jusqu’à 16 fois)
  → queueViewportFetch(bounds, { immediate: true, force: true })
  → runViewportFetch
  → setShape + displayViewportResults
```

Parallèle : si `userLocation` disponible, premier `recenterToUser()` (fit radius 7.5 km).

---

## 2. Changement de bounds de carte

`MapWrapper` émet `onVisibleBoundsChange(bounds, { isUserInteraction? })`.

Décision dans `handleBoundsChange` :

```
isUserInteraction?
  yes → clear programmatic state
     → si frozen: unlockViewportFromUserPan + fetch force
     → sinon: queueViewportFetch immediate force

isProgrammaticMoveRef?
  yes → clear flag
     → si pendingProgrammaticRefresh: queueViewportFetch force
     → sinon: stop (pas de refetch)

viewportFrozenRef?
  yes → stop

isSheetDragging || bounds suppressed?
  yes → stop

sinon → queueViewportFetch (debounce 300 ms)
```

---

## 3. Mouvement utilisateur vs programmatique

**Utilisateur** : pan/zoom Mapbox → `isUserInteraction: true` → toujours prioritaire.

**Programmatique** : `startProgrammaticMove` / `withProgrammaticMove` :
- pose `isProgrammaticMoveRef = true`
- option `refreshAfter` → `pendingProgrammaticRefreshRef`
- option `durationMs` → `suppressBoundsRecalc(durationMs + 250)`

Cas programmatiques : search fit, refit frozen viewport, focus event, recenter.

---

## 4. Sélection d’un marker

```
onFeaturePress(id)
  → cancelViewportFetch() + cancelMarkerFetch()
  → getEventById (avec requestId marker)
  → highlightViewportEvent + setUnitCardEvent (preview card)
  → si pas frozen: freezeViewportResults + viewportFrozenRef=true
  → focusOnEvent (sans bump zoom)
```

La preview card est indépendante du mode `singleEvent` de la sheet.

---

## 5. Gel du viewport

Déclenché par :
- `lockViewportForSheet()` quand sheet index ≥ 1
- `handleFeaturePress` si pas déjà frozen

Effets :
- `freezeViewportResults()` copie `sheetEvents` → `frozenViewport`
- `frozenViewportBoundsRef` capture bounds visibles
- `queueViewportFetch` ignoré sauf `force: true`
- `runViewportFetch` met à jour shape mais **pas** `displayViewportResults` si frozen

Dégel : pan utilisateur (`unlockViewportFromUserPan`) ou `refreshBounds()`.

---

## 6. Drag / snap bottom sheet

```
Drag start → beginSheetDrag + suppressBoundsRecalc
Drag move → updateSheetDrag (layout only, pas de refit carte par frame)
Drag end  → finishSheetDrag (timing) → onSettled: syncMapToFrozenViewport
         → setBottomSheetIndex + applySheetSideEffects
```

`applySheetSideEffects` :
- index 0 : `closeSheet()`
- index ≥ 1 : `lockViewportForSheet()`, clear preview card
- singleEvent : `focusOnEvent` sur premier event
- scroll liste vers `activeEventId` si présent

---

## 7. Recherche appliquée

```
SearchBar onApply → applySearch()
  → metaFilter = 'all'
  → commitSearch + setStatus('loading')
  → resolveSearchTargetBounds()
     → si location: fitToRadius(location)
     → si radius + userLocation: fitToRadius(user)
     → sinon: refreshBounds()
```

Le refresh des résultats est déclenché par `onVisibleBoundsChange` après le move programmatique (`pendingProgrammaticRefresh`).

---

## 8. Deep-link `focus`

```
useEffect([focus]) une fois
  → handleFeaturePress(focus)
```

Même pipeline que sélection marker.

---

## 9. Retour depuis fiche détail

```
useFocusEffect
  → si sheetStatus === 'singleEvent' && frozenViewport
     → restoreViewportFromFrozen({ keepHighlight: true })
```

Le clic liste vers détail **ne** passe plus en `singleEvent` (highlight seulement).

---

## Accessibilité — Reduce Motion

Le projet expose `useReduceMotion` (`src/hooks/useReduceMotion.ts`) pour les composants animés (cards, overlays, détail).

L’écran carte utilise `SHEET_LAYOUT_TIMING` (timing, pas spring) pour le resize layout ; une future passe pourra court-circuiter via `useReduceMotion`.

---

## Annulation des requêtes

| Helper | Effet |
|--------|-------|
| `cancelViewportFetch()` | `viewportRequestIdRef++` + clear debounce |
| `cancelMarkerFetch()` | `markerRequestIdRef++` |
| `cancelAllMapRequests()` | les deux |

Utilisé au marker press, unmount, et avant certains changements sheet.
