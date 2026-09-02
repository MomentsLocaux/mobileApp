# MapScreen — orchestration des flows

Écran carte : `app/(tabs)/map.tsx`. Ticket **MVP-P1-004**.

**Données viewport** : `listMapViewportForMap` (`src/utils/bbox-event-fetch.ts`) → RPC Supabase **`list_map_viewport`**. Compteur client : `MAP_VIEWPORT_LIMIT_MAX` (1500) pour toute zone **autorisée** (`MAX_MAP_BBOX_DIAMETER_KM`) — plus de palier 500/700/1000 selon le zoom. La RPC clamp encore `p_limit` à 1500.

**Recherche textuelle (Quoi)** : `list_map_viewport` n’a pas de paramètre nom. Quand `content.query` / `filters.name` est renseigné, Home et le compteur SearchBar passent par `listEvents` (`title` + `description` `ilike`, comme un Ctrl+F). Sur la carte, le fetch bbox est **fusionné** avec ce même `ilike` dans le viewport visible (`fetch-discovery-search-events.ts`). Sans lieu explicite, une requête texte seule n’est pas clipée au GPS.

**Contrat produit** (helpers : `src/utils/map-discovery-contract.ts`) :

| Mode | Condition | Pan / zoom utilisateur | Recentrer |
|------|-----------|------------------------|-----------|
| `browse` | pas de recherche appliquée | fetch bbox (debounce 300 ms) | fit **20 km** (`DISCOVERY_DEFAULT_RADIUS_KM`) + fetch |
| `search` | `searchApplied && hasSearchCriteria` | pas de fetch ; chip « Rechercher dans cette zone » | sort en `browse` autour de l’utilisateur |
| `homeHandoff` | ping recadrage one-shot | puis `browse` ou `search` selon les critères Home | fit **rayon Home** + refetch |

`homeTransfer` n’est **jamais** un mode permanent : c’est un signal de recadrage, pas un snapshot de liste. Après fit + fetch, le store est vidé. Un transfert nearby n’active pas le lock recherche. Les filtres restent dans `discoveryFiltersStore`.

En **search**, le pan n’auto-fetche pas. En **browse**, si. Le chip conserve quoi/quand et relâche seulement le verrou géographique.

**Filtres temporels** : le défaut Home / Map browse est **Aujourd’hui** (`status: all` + `when.preset: today`), pas En cours. En cours reste disponible dans le panneau. `today` n’est pas un critère de recherche (pas de lock carte). La SearchBar Home affiche ce défaut (« Aujourd’hui · 20 km ») comme n’importe quel filtre choisi, pour que l’utilisateur voie ce qui est listé. Sur la carte, le rayon n’est pas affiché par défaut (browse = viewport visible).

**Refine viewport (sans lock)** : bouton curseurs à droite de la SearchBar, **avec le point vert** (filtre temporel toujours actif, y compris Aujourd’hui). Sous-section **sous la barre** : période (Tous / En cours / Aujourd’hui / Demain / Ce week-end / À venir / Passés + date précise) et catégories (tout sélectionner / désélectionner). `setStatus` / `setWhen` / `setContent` **sans** `searchApplied`. Pins = liste. Refetch bbox si le time scope change ou si une date (preset / range) l’exige. Visible en browse **et** en recherche. Lieu et texte restent dans la modale SearchBar. La bottom sheet ne contient plus que le tri. « Effacer les filtres » n’apparaît que pour un écart au défaut (catégories ou autre période).

Le toggle satellite n’est plus à côté de la recherche : il est groupé avec le recentrage GPS (outils carte).

Si la sheet est au snap **full (92 %)** et que l’utilisateur ouvre l’overfilter, on la ramène au **half (55 %)** pour laisser voir pins + chips. Fermer le panneau restaure le full **seulement** si l’utilisateur n’a pas bougé la sheet (et n’est pas passé en fiche single). Peek / half inchangés. Ouvrir la SearchBar ferme le panneau sans restaurer le full.

| Filtre | Browse | Search active |
|--------|--------|----------------|
| Catégories / sous-catégories | client, toujours | client, toujours |
| Statut Tous / En cours / À venir / Passés | meta + refetch si scope RPC change | idem |
| `when` (preset, range) | client en browse refine ; refetch si besoin | client + lock géographique seulement si autre critère (lieu / texte / date non défaut) |

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

Le bbox de fetch **n’inclut pas** la bande recouverte par la sheet : `getVisibleBounds` est inset vers le nord de `sheetCoverPx / mapHeight` (peek 72 px, half/full selon le snap). Helper `insetMapBoundsForBottomOverlay`.

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
Home SearchBar Apply (et recherches sauvegardées)
  → setHomeTransfer()  // ping recadrage ; filtres déjà dans discoveryFiltersStore

Onglet Map / enterFocusedMap
  → si ping nouveau OU searchRevision nouveau
  → dégel sheet + resolveHomeMapRadiusTarget (cercle Home)
  → fitToRadius après InteractionManager (Mapbox visible)
  → clearHomeTransfer()
  → browse si pas de recherche Home, sinon search (chip)
```

Le CTA empty Home « Lancer une recherche » / « Rechercher un lieu » ouvre la SearchBar **Home**, pas l’onglet Map.

Un Apply Home suivant remplace le ping : la Map n’est plus collée à la première recherche.

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
