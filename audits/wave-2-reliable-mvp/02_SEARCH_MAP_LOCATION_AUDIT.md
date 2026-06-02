# 02 - Search / Map / Location Audit

## Résumé exécutif

La carte et la recherche sont le coeur MVP. Le socle est solide : Mapbox, bbox, recherche lieu, filtres quoi/où/quand, rayon, tri, bottom sheet et fallback sur Fontoy si la localisation n'est pas exploitable. Les requêtes publiques filtrent bien `published` + `public` dans le data-provider.

Les risques principaux concernent la demande de localisation trop précoce, la cohérence entre bbox et rayon, les erreurs Mapbox silencieuses, et la dépendance à une RPC pour récupérer les détails d'événements.

Niveau actuel : bon pour une bêta contrôlée, à stabiliser avant store.

## Constats

### Carte Mapbox

- `MapScreen` utilise `MapWrapper`, `listEventsByBBox`, puis `getEventsByIds`.
- Les bounds sont debouncées à 400 ms.
- Les anciens timers bbox sont annulés.
- Les mouvements programmatiques sont ignorés temporairement pour éviter certains refetchs.
- `MapWrapper` désactive la télémétrie Mapbox.

### Événements publics

- `listEventsByBBox` filtre `status = published` et `visibility = public`.
- `listEvents` filtre aussi `published/public` hors `creatorId`.
- Les événements passés sont exclus par défaut avec condition `starts_at <= now` et `ends_at null ou >= now`.
- Les filtres UI permettent d'inclure les événements passés.

### Recherche

- `SearchBar` recherche les adresses via `MapboxService.search`.
- Les résultats sont limités à la France.
- Un rayon par défaut de 10 km est appliqué quand un lieu est choisi.
- La recherche compte les résultats en rechargeant jusqu'à 300 événements.
- Les filtres client appliquent catégories, tags, dates, rayon et tri.

### Localisation

- `useLocation` demande la permission au montage.
- Sur la carte, `useLocation()` est appelé directement, donc la permission peut être demandée dès l'arrivée sur la carte.
- Si la localisation est refusée, la carte utilise un centre fallback `FONTOY_COORDS`.
- Le tri distance est désactivé ou averti si la localisation manque selon composants.

### Erreurs Mapbox

- `MapboxService.search` et `reverse` retournent `[]` ou `null` si token absent, requête vide ou réponse non OK.
- Peu de feedback utilisateur est affiché pour distinguer "aucun résultat" d'une erreur réseau/API.
- Si `EXPO_PUBLIC_MAPBOX_TOKEN` manque, un warning console est émis.

### Bbox vs rayon

- Le rayon est converti en bbox approximative.
- Le filtrage exact par rayon est ensuite fait côté client.
- C'est acceptable MVP, mais peut charger des événements hors rayon avant filtrage.

## Risques

- Demande de permission localisation trop tôt, réduisant le taux d'acceptation.
- Recherche adresse silencieusement vide en cas d'erreur Mapbox.
- RPC `get_events_by_ids` exposant des événements non publics si mal sécurisée.
- Refetchs coûteux lors de mouvements rapides de carte.
- Incohérence perçue entre nombre de résultats et marqueurs si filtres client/serveur divergent.
- Carte vide sans explication claire.

## Recommandations

- Demander la localisation sur action explicite ou avec un écran/prompt contextualisé.
- Ajouter un état utilisateur clair pour erreur Mapbox, token absent ou réseau faible.
- Vérifier `get_events_by_ids` côté RLS/RPC : hors owner/admin, retourner seulement `published/public`.
- Garder bbox serveur + filtre rayon client pour MVP, mais documenter la limite.
- Ajouter un état "aucun résultat" plus actionnable : élargir rayon, retirer filtres, inclure passés.
- Prévoir une ville/zone par défaut configurable plutôt que coordonnées hardcodées.

## Quick wins

- Afficher un message si localisation refusée : "Carte centrée sur une zone par défaut".
- Afficher un message si recherche adresse échoue.
- Limiter ou cacher "Passés" si l'UX MVP ne doit pas encourager les événements expirés.
- Vérifier que `focus` deep link ne charge pas un événement privé/pending.

## Fichiers concernés

- `app/(tabs)/map.tsx`
- `src/components/map/MapWrapper.tsx`
- `src/components/search/SearchBar.tsx`
- `src/components/search/SearchResultsBottomSheet.tsx`
- `src/services/mapbox.service.ts`
- `src/hooks/useLocation.ts`
- `src/utils/filter-events.ts`
- `src/utils/sort-events.ts`
- `src/data-provider/supabase-provider.ts`

## Scénarios à tester

- Ouvrir carte sans session.
- Ouvrir carte avec localisation acceptée.
- Ouvrir carte avec localisation refusée.
- Ouvrir carte sans token Mapbox.
- Recherche adresse valide.
- Recherche adresse sans réseau.
- Recherche sans résultat.
- Filtre catégorie/tag.
- Filtre date future.
- Inclure événements passés.
- Rayon 0, 5, 10, 50 km.
- Tri distance sans localisation.
- Déplacement rapide de la carte.
- Zoom/dézoom répété.
- Deep link `/(tabs)/map?focus=eventId`.
- Vérifier qu'un `draft/pending/refused/private` n'apparaît jamais.

## Priorisation

### P0

- Vérifier RLS/RPC `get_events_by_ids` pour éviter fuite d'événements non publics.
- Garantir qu'aucun événement `draft/pending/refused/private` n'apparaît sur carte/liste.

### P1

- Améliorer feedback utilisateur erreurs Mapbox/localisation.
- Reporter ou contextualiser la demande de permission localisation.
- Stabiliser les états empty/loading.

### P2

- Optimiser recherche serveur avec filtres SQL/RPC.
- Ajouter préférences de ville par défaut.
- Ajouter cache local des résultats récents.
