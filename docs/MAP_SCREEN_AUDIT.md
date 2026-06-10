# MapScreen — audit technique (refactor)

## Responsabilités actuellement dans `app/(tabs)/map.tsx`

| Domaine | Responsabilités |
|---------|-----------------|
| **Layout / sheet** | `useMapSheetSplitLayout`, animations Reanimated, snap index, drag handlers |
| **Viewport / fetch** | bbox debounce, request IDs, frozen viewport, bounds suppression, programmatic move |
| **Data pipeline** | `runViewportFetch` (API → filtres → tri → shape Mapbox → store) |
| **Carte** | `MapWrapper` ref, fit bounds, focus coordinate, recenter, map mode |
| **Sélection** | marker press, preview card (`unitCardEvent`), highlight, cache événements |
| **Bottom sheet UI** | index change, side effects collapse/expand, scroll to active |
| **Recherche** | `applySearch`, critères, filtres SearchBar |
| **Filtres / tri** | metaFilter, MapFiltersSheet, reapply local sort |
| **Social** | like / favori via `SocialService` |
| **Navigation** | routes détail, créateur, NavigationOptionsSheet |
| **Deep-link** | param `focus` |
| **Focus screen** | restore liste après détail, initial load, search applied |

## Refs critiques

| Ref | Rôle | Risque si désync |
|-----|------|------------------|
| `viewportRequestIdRef` | Annule fetch bbox obsolètes | Résultats périmés affichés |
| `markerRequestIdRef` | Annule `getEventById` marker | Preview card sur mauvais événement |
| `viewportFrozenRef` | Bloque refetch pendant sheet ouverte | Liste/carte incohérentes |
| `frozenViewportBoundsRef` | Bounds gelés pour refit caméra | Carte recentrée hors zone |
| `isProgrammaticMoveRef` | Distingue move auto vs utilisateur | Refetch intempestif ou absent |
| `pendingProgrammaticRefreshRef` | Refresh après move programmatique | Données non rafraîchies après search |
| `suppressBoundsRecalcUntilRef` | Ignore bounds pendant animations | Boucles refit / fetch |
| `bboxTimeoutRef` | Debounce 300 ms viewport fetch | Fetchs en rafale |
| `isSheetDraggingRef` | Ignore bounds pendant drag sheet | Refetch pendant drag |
| `eventCacheRef` | Cache local événements | Stale data preview |
| `focusHandledRef` | Deep-link une seule fois | Double focus |
| `singleEventFocusIdRef` | Focus singleEvent sheet | Re-open sheet en boucle |

## Fonctions les plus sensibles

1. `handleBoundsChange` — arbitre user / programmatic / frozen / suppressed
2. `runViewportFetch` — pipeline data + mise à jour shape + store
3. `handleFeaturePress` — annule viewport, charge event, freeze optionnel
4. `handleSheetIndexChange` / `handleSheetDragEnd` — layout + freeze + refit caméra
5. `useFocusEffect` — restore viewport, collapse peek, refresh search
6. `applySearch` — move carte + refresh implicite via bounds
7. `lockViewportForSheet` / `syncMapToFrozenViewport` — continuité spatiale carte/liste

## Extraction réalisée

| Module | Fichier |
|--------|---------|
| Orchestration data | `useMapScreenData` |
| Move programmatique | `useMapProgrammaticMove` |
| Viewport / bounds | `useMapViewportController` |
| Fetch bbox + annulations | `useViewportEventsFetch` |
| Side effects sheet | `useMapSheetOrchestration` |
| Recherche | `useMapSearchApply` |
| Social | `useMapSocialActions` |
| Marker press | `useMapMarkerPress` |
| Types carte | `src/types/map-events.ts` |
| Constantes écran | `src/constants/map-screen.ts` |

## Comportements à ne pas modifier

- Snaps sheet : peek → 55 % → 92 %
- Gel viewport dès sheet index ≥ 1
- Preview card au marker (sans réduire la liste au clic détail)
- Restore `frozenViewport` au retour détail
- Deep-link `focus`
- Fallback Fontoy si pas de GPS réel
