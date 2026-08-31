# MapScreen — orchestration des flows

Écran carte : `app/(tabs)/map.tsx`. Ticket **MVP-P1-004**.

**Données viewport** : `listMapViewportForMap` (`src/utils/bbox-event-fetch.ts`) → RPC Supabase **`list_map_viewport`**.

**Contrat produit** (helpers : `src/utils/map-discovery-contract.ts`) :

| Mode | Condition | Pan / zoom utilisateur | Recentrer |
|------|-----------|------------------------|-----------|
| `browse` | pas de recherche appliquée | fetch bbox (debounce 300 ms) | fit **20 km** (`DISCOVERY_DEFAULT_RADIUS_KM`) + fetch |
| `search` | `searchApplied && hasSearchCriteria` | pas de fetch ; chip « Rechercher dans cette zone » | sort en `browse` autour de l’utilisateur |
| `homeHandoff` | ping recadrage one-shot | puis `browse` ou `search` selon les critères Home | fit **rayon Home** + refetch |

`homeTransfer` n’est **jamais** un mode permanent : c’est un signal de recadrage, pas un snapshot de liste. Après fit + fetch, le store est vidé. Un transfert nearby n’active pas le lock recherche. Les filtres restent dans `discoveryFiltersStore`.

En **search**, le pan n’auto-fetche pas. En **browse**, si. Le chip conserve quoi/quand et relâche seulement le verrou géographique.

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

`refreshAfter` est **opt-in** (`refreshAfter === true`). Focus marker et refit sheet passent `false`. Handoff Home, search apply et recenter passent `true`.

---

## 1. Chargement initial du viewport

Un seul bootstrap, après `onMapReady` :

```
recherche / handoff Home → enterFocusedMap (fit rayon + refetch)
GPS disponible, browse → useMapLocationBootstrap → recenter 20 km (refreshAfter: true)
lieu de recherche explicite, sans GPS → caméra sur ce lieu + fetch
sinon → vue France (pas de ville hardcodée) ; fetch seulement après zoom ou SearchBar
```

`enterFocusedMap` ne refetch **pas** à chaque focus d’onglet une fois `viewportBootstrappedRef` vrai.

---

## 2. Changement de bounds de carte

`MapWrapper` émet `onVisibleBoundsChange(bounds, { isUserInteraction? })`.

```
isUserInteraction?
  yes → clear programmatic state
     → si searchActive: chip « Rechercher dans cette zone » (pas de fetch)
     → si frozen: unlockViewportFromUserPan + fetch force
     → sinon: queueViewportFetch immediate force

isProgrammaticMoveRef?
  yes → clear flag
     → si pendingProgrammaticRefresh: queueViewportFetch force
     → sinon: stop

viewportFrozenRef? → stop
isSheetDragging || bounds suppressed? → stop
sinon → queueViewportFetch (debounce 300 ms)
```

---

## 3. Mouvement utilisateur vs programmatique

**Utilisateur** : pan/zoom Mapbox → `isUserInteraction: true` → toujours prioritaire.

**Programmatique** : `withProgrammaticMove(..., { refreshAfter })` — le refetch n’a lieu que si `refreshAfter: true`.

---

## 4. Sélection d’un marker

```
onFeaturePress(id)
  → cancelViewportFetch() + cancelMarkerFetch()
  → getEventById (avec requestId marker)
  → highlightViewportEvent + setUnitCardEvent (preview card)
  → si pas frozen: freezeViewportResults + viewportFrozenRef=true
  → focusOnEvent (refreshAfter: false)
```

Tant que frozen / `singleEvent`, un fetch terminé **n’** met à jour ni `setShape` ni la liste. Un `reapplyClientFilters` (tri) passe `ignoreFreeze` pour garder pins = liste.

---

## 5. Gel du viewport

Déclenché par `lockViewportForSheet()` (sheet index ≥ 1) et par le marker press.

Dégel : repli de la sheet (`unlockViewportForSheet`), tap fond de carte, fermeture de la preview marker, pan utilisateur (`unlockViewportFromUserPan`), `refreshBounds()`, chip zone, ou recenter.

Le follow caméra (padding bas = hauteur de sheet) ne s’applique qu’entre peek et half, tant que la carte reste visible. Au snap full (92 %), **aucun** `fitToBounds` : la carte est cachée, un recadrage est inutile et peut perturber Mapbox. Le repli peek restaure le padding standard.

---

## 6. Home → Map

```
Home « Voir sur la map »
  → setHomeTransfer()  // ping recadrage ; filtres déjà dans discoveryFiltersStore
  → router.push map

enterFocusedMap
  → resolveHomeMapRadiusTarget (cercle Home : GPS 20 km ou lieu cherché)
  → fitToRadius(..., { refreshAfter: true })
  → clearHomeTransfer()
  → browse si pas de recherche Home, sinon search (chip)
```

Le CTA empty Home « Rechercher un lieu » (`openSearch`) **vide** le transfer avant navigation.

---

## 7. Recherche appliquée

```
SearchBar onApply → applySearch()
  → syncSearchState + setStatus('loading')
  → fitToRadius(..., { refreshAfter: true })
     ou refreshBounds() si pas de centre
```

Chip zone : clear place (centre/rayon), conserve quoi/quand, `refreshBounds()`, clear transfer. **Pas** de `resetCriteria()`.

---

## 8. Deep-link `focus`

Prioritaire sur un transfer Home (le transfer est détruit). Même pipeline que sélection marker.

---

## 9. Retour depuis fiche détail

```
useFocusEffect
  → si sheetStatus === 'singleEvent' && frozenViewport
     → restoreViewportFromFrozen({ keepHighlight: true })
  → pas de refreshBounds si déjà bootstrappé
```

---

## Annulation des requêtes

| Helper | Effet |
|--------|-------|
| `cancelViewportFetch()` | `viewportRequestIdRef++` + clear debounce |
| `cancelMarkerFetch()` | `markerRequestIdRef++` |
| `cancelAllMapRequests()` | les deux |
