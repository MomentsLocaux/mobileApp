# 03 - Performance Mobile Audit

## Résumé exécutif

L'application utilise des outils adaptés au mobile : Expo Router, Zustand, Mapbox, bottom sheets virtualisées et requêtes limitées. La performance sera probablement acceptable en bêta si le volume reste maîtrisé. Les risques viennent surtout des images non redimensionnées, de la carte qui recharge plusieurs couches de données, et des appels stats/réseau additionnels par liste d'événements.

Niveau actuel : correct, mais à mesurer sur appareils réels Android/iOS.

## Constats

### Lancement

- Expo SDK 54, React Native 0.81, React 19.
- `newArchEnabled: true` est activé.
- Plusieurs providers et stores sont chargés au démarrage.
- `app/_layout.tsx` initialise auth et session.
- Aucun budget de temps de lancement mesuré n'a été identifié.

### Carte

- Le fetch bbox est debouncé.
- La limite bbox est à 300 features.
- Les ids affichés sont limités à 120 pour charger les détails.
- Un cache mémoire `eventCacheRef` est utilisé pour les événements sélectionnés.
- Les déplacements rapides peuvent encore déclencher plusieurs cycles `bbox -> ids -> details`.

### Recherche

- La recherche compte les résultats avec un fetch dédié.
- Les filtres détaillés sont majoritairement appliqués côté client après chargement.
- Les recherches Mapbox sont debouncées à 250 ms.

### Listes

- `SearchResultsBottomSheet` utilise `BottomSheetFlatList`.
- Les listes favoris/profils doivent être vérifiées, mais le pattern principal est virtualisé.
- Les cards chargent images et stats.

### Stats par événement

- `EventCardStatsService.getStatsForEvents` appelle une RPC `get_event_views_counts`.
- Si la RPC échoue, fallback direct sur `event_views`.
- Le fallback peut être coûteux et dépend de RLS.
- Le calcul "friends going" charge les follows puis les favoris par chunks.

### Images

- Les images sont uploadées en qualité 0.8 mais pas forcément redimensionnées.
- Les cards affichent des URLs publiques sans stratégie thumbnail claire.
- Picsum/test data peut masquer les vrais coûts réseau.

### Subscriptions et timers

- Notifications realtime nettoyées via `supabase.removeChannel`.
- Intervalles de temps dans cards/détail nettoyés selon grep.
- Timers carte principaux nettoyés au démontage.
- Certains `setTimeout` ponctuels ne sont pas critiques mais méritent revue.

### Zustand

- Stores segmentés : location, search, map UI, favorites, likes, taxonomy.
- Certains selectors sont précis, ce qui réduit les re-renders.
- Les stores persistés utilisent AsyncStorage avec fallback FileSystem.

## Risques

- Images lourdes et non redimensionnées consommant mémoire et bande passante.
- Carte lente sur Android moyen de gamme.
- Fallback `event_views` coûteux si RPC absente.
- Refetchs redondants pendant navigation carte.
- Re-renders de bottom sheet lors de changement favoris/likes/stats.
- Absence de mesures réelles avant bêta.

## Recommandations

- Mesurer sur appareils réels :
  - cold start
  - temps premier rendu carte
  - temps premier résultat recherche
  - mémoire après 10 minutes carte
- Ajouter redimensionnement images avant upload.
- Valider que `get_event_views_counts` est disponible et performante en staging/prod.
- Éviter fallback `event_views` brut en production si table sensible.
- Ajouter pagination ou limites strictes sur toutes les listes longues.
- Prévoir cache court pour bbox et détails événements.
- Tester Android bas/moyen de gamme.

## Quick wins

- Valider présence RPC `get_event_views_counts`.
- Mettre une limite stricte sur le poids image.
- Ajouter logs de perf temporaires en dev uniquement.
- Vérifier que les écrans non-MVP lourds ne sont pas montés.
- Tester carte avec 100, 300, 1000 événements.

## Fichiers concernés

- `app/(tabs)/map.tsx`
- `src/components/map/MapWrapper.tsx`
- `src/components/search/SearchResultsBottomSheet.tsx`
- `src/components/search/EventResultCard.tsx`
- `src/services/event-card-stats.service.ts`
- `src/hooks/useImagePicker.ts`
- `src/store/*`
- `src/store/persistStorage.ts`

## Scénarios à tester

- Cold start iPhone récent.
- Cold start Android moyen de gamme.
- Ouverture carte sans cache.
- Déplacement carte pendant 2 minutes.
- Zoom/dézoom rapide.
- Recherche avec beaucoup de résultats.
- Bottom sheet avec 120 événements.
- Liste favoris longue.
- Détail événement avec plusieurs médias.
- Upload grande image.
- Navigation répétée carte/détail/profil.
- App en arrière-plan puis retour.

## Priorisation

### P0

- Éviter toute fuite mémoire/listener/subscription.
- Vérifier que les images lourdes ne peuvent pas faire crasher l'app.
- Vérifier RPC stats ou désactiver fallback coûteux.

### P1

- Mesurer performance sur appareils réels.
- Ajouter compression image.
- Ajouter cache court carte/recherche.

### P2

- Optimiser requêtes serveur avec filtres SQL.
- Ajouter thumbnails/CDN.
- Ajouter monitoring performance.
