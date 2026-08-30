# Audit approfondi de `app/(tabs)/map.tsx`

**Date :** 2026-08-30  
**Ticket de rattachement :** `MVP-P1-004 — Stabiliser search/map/location`  
**Branche :** `audit/map-tsx-deep-analysis`  
**Nature :** audit statique ciblé, sans modification applicative ni migration  
**Statut :** amélioration requise avant de considérer la surface comme durablement scalable

## 1. Synthèse exécutive

`map.tsx` repose sur des choix globalement professionnels : typage TypeScript, composants spécialisés, hooks métier extraits, limites de résultats, clustering Mapbox, liste virtualisée, gestion des requêtes obsolètes, repli réseau, tokens de design et libellés d’accessibilité sur les actions majeures.

Le fichier reste toutefois trop chargé pour être une frontière d’écran durable. Avec **1 103 lignes**, **18 callbacks**, **16 refs**, **9 mémos**, **6 états locaux** et **6 effets**, il orchestre simultanément :

- la permission et le centrage de localisation ;
- les paramètres de navigation ;
- les filtres et tris ;
- la caméra Mapbox ;
- le cycle de vie du viewport ;
- le gel et la restauration des résultats ;
- les interactions marqueur/fiche ;
- les gestes et animations de la bottom sheet ;
- la navigation vers les événements, créateurs et applications de carte ;
- les états d'erreur, de chargement et les actions sociales.

Le résultat est sophistiqué mais prend la forme d'une **machine d'état implicite et distribuée** entre `map.tsx`, les hooks `src/hooks/map/`, `useMapSheetSplitLayout`, `MapWrapper`, `SearchResultsBottomSheet` et Zustand. Cette architecture peut fonctionner aujourd'hui, mais elle rend les régressions difficiles à prévoir et à tester.

**Verdict global : 6,5/10.** La base est crédible pour un MVP, mais la maintenabilité, la testabilité et la preuve de scalabilité doivent être renforcées avant une croissance importante du volume de données ou de l'équipe.

## 2. Périmètre et méthode

L'analyse couvre :

- `app/(tabs)/map.tsx` ;
- ses hooks directs sous `src/hooks/map/` ;
- `useMapSheetSplitLayout` et `useLocation` ;
- `MapWrapper` et `SearchResultsBottomSheet` ;
- les stores de résultats carte ;
- le chemin de lecture `bbox-event-fetch` → `EventsService` → RPC Supabase ;
- les migrations `list_map_viewport` et leurs index ;
- la charte des surfaces UI concernées par la carte.

Elle ne comprend pas :

- de profilage sur appareil physique ;
- de test E2E de gestes ;
- de mesure réseau en conditions réelles ;
- d'`EXPLAIN (ANALYZE, BUFFERS)` sur la base de production ;
- de validation visuelle exhaustive iOS/Android.

Les conclusions de performance serveur sont donc des évaluations de conception, pas une preuve de capacité.

## 3. Tableau d'évaluation

| Axe | Note | Conclusion |
|---|---:|---|
| Cohérence fonctionnelle | 7,5/10 | Les parcours carte, marqueur, feuille, recherche et navigation forment un ensemble logique. |
| Consistance architecturale | 6/10 | Hooks bien extraits, mais orchestration encore très concentrée et état dupliqué. |
| Professionnalisme | 7,5/10 | Bon niveau de soin, de commentaires, de garde-fous et de gestion des replis. |
| Maintenabilité | 5,5/10 | Taille, couplage et callbacks impératifs augmentent fortement le coût des changements. |
| Testabilité | 4/10 | Les transitions critiques ne disposent pas de tests directs identifiés. |
| Fiabilité | 6,5/10 | Requêtes obsolètes ignorées et erreurs gérées, mais annulation et temporisations incomplètes. |
| Performance mobile | 6,5/10 | Clustering et virtualisation sont solides ; plusieurs sources de travail redondant subsistent. |
| Scalabilité données | 6,5/10 | RPC bornée et indexée, mais absence de preuve par plan d'exécution et cache très limité. |
| Accessibilité | 6/10 | Actions principales libellées ; états dynamiques et solution de repli restent incomplets. |
| Cohérence visuelle | 7/10 | Tokens de marque largement utilisés ; quelques contrastes doivent être validés. |

## 4. Architecture observée

```text
MapScreen
├── stores auth / localisation / discovery / favoris / likes
├── useMapScreenData
│   ├── useMapViewportController
│   └── useViewportEventsFetch
│       └── bbox-event-fetch
│           └── EventsService
│               └── RPC Supabase list_map_viewport
├── useMapSheetOrchestration + useMapSheetSplitLayout
├── useMapSearchApply / useMapSocialActions / useMapMarkerPress
├── MapWrapper (Mapbox, sources, clusters, caméra)
└── SearchResultsBottomSheet (FlatList, gestes, tri, fiche)
```

La séparation existe donc déjà. Le problème est que `MapScreen` reste le lieu où presque toutes les transitions se rejoignent, sans modèle explicite décrivant les états autorisés et leurs événements.

## 5. Points solides

### 5.1 Découpage progressif réel

Les accès aux données, la sélection de marqueur, l'application d'une recherche, les actions sociales et une partie de l'orchestration de la feuille sont extraits. Ce n'est pas un composant monolithique naïf : le travail de modularisation est visible et réduit déjà une partie de la complexité.

### 5.2 Protection contre les réponses obsolètes

Les hooks attribuent des identifiants aux requêtes de viewport et de marqueur. Une réponse ancienne ne remplace pas la sélection ou le viewport courant. C'est un garde-fou important sur une carte où les interactions peuvent être rapides.

### 5.3 Stratégie de chargement bornée

- RPC `list_map_viewport` limitée à 1 500 événements maximum ;
- plafond adaptatif de 500 à 1 500 selon le zoom ;
- liste de feuille limitée à 120 événements ;
- jointures profil/catégorie effectuées après la limite dans la RPC ;
- avatar filtré pour éviter les payloads anormalement lourds ;
- clustering des marqueurs côté Mapbox ;
- `FlatList` configurée avec rendu initial et fenêtres bornés.

Ces choix protègent correctement le MVP contre une croissance modérée.

### 5.4 Chemin serveur spécialisé

La carte privilégie une RPC card-lite en un aller-retour, avec un fallback conservateur vers l'ancien chemin bbox + IDs. La RPC filtre explicitement `published` et `public`, borne ses paramètres et fixe son `search_path`. Des index partiels existent sur les dates et `(latitude, longitude)` pour les événements publics publiés.

### 5.5 Soin UI et produit

- respect des safe areas ;
- bornes de caméra France ;
- chargement de localisation visible ;
- bannière d'erreur viewport refermable ;
- actions principales avec rôle et libellé d'accessibilité ;
- tokens `colors`, `spacing` et `borderRadius` ;
- liste visible comme alternative pratique à l'exploration par marqueurs.

### 5.6 Instrumentation ciblée

Les transitions de feuille importantes utilisent `traceMapSheetPerf`. C'est une bonne base pour mesurer les gestes et régressions, à condition de transformer ces traces en budget et scénarios reproductibles.

## 6. Constats prioritaires

### P1 — Absence de tests directs de la machine d'état carte/feuille

Aucun test direct n'a été identifié pour `map.tsx`, `useMapViewportController`, `useViewportEventsFetch`, `useMapMarkerPress` ou `useMapSheetSplitLayout`.

Les transitions suivantes reposent donc surtout sur des refs, temporisations et vérifications manuelles :

- premier chargement ;
- déplacement utilisateur contre déplacement programmatique ;
- gel du viewport pendant l'ouverture d'une fiche ;
- retour fiche → liste ;
- déplacement de caméra pendant le drag ;
- changement de filtres pendant une requête ;
- sélection rapide de plusieurs marqueurs ;
- retour au focus de l'onglet ;
- chargement avec permission de localisation refusée.

**Risque :** régression silencieuse sur les séquences plutôt que sur les fonctions isolées.

**Recommandation :** extraire un contrôleur testable ou un reducer d'états, puis couvrir au minimum ces scénarios avec des timers simulés et des réponses réseau contrôlées.

### P1 — Invalidation logique sans véritable annulation réseau

Les identifiants de requête empêchent une réponse obsolète de modifier l'UI, mais ils n'annulent pas le travail réseau ou serveur. Le timeout client de 4 secondes utilise `Promise.race` : la RPC originale continue potentiellement alors que le fallback démarre. Un retry silencieux peut ensuite ajouter une troisième tentative.

**Risque :** amplification de trafic lors d'une connexion lente, d'un panoramique rapide ou d'un serveur sous charge.

**Recommandation :** rendre le chemin de lecture annulable lorsque la pile le permet, nettoyer le timer du timeout dans un `finally`, dédupliquer les requêtes identiques en vol et suivre séparément timeout, fallback et retry.

### P1 — Expérience de localisation incomplète

`useLocation()` demande la permission dès le montage. Le hook stocke bien un refus ou une erreur, mais `map.tsx` ne lit que `currentLocation` et `isLoading`. Après refus, l'écran retombe sur Fontoy sans expliquer clairement pourquoi ni proposer de réessayer ou d'ouvrir les réglages.

**Risque :** comportement perçu comme erroné, difficulté à comprendre les résultats et absence de contrôle explicite pour l'utilisateur.

**Recommandation :** afficher un état non bloquant « localisation indisponible », expliquer le centre par défaut, proposer une relance et garantir que la recherche par lieu reste complète sans GPS.

### P1 — Scalabilité serveur non démontrée

La RPC est raisonnablement conçue, mais elle peut retourner jusqu'à 1 500 lignes et exécute deux sous-requêtes de comptage corrélées par événement pour intérêts et check-ins. Les index `event_id` existent dans l'historique des migrations, ce qui réduit le risque, sans prouver le coût réel. Le filtre temporel contient plusieurs branches `OR` et le tri tient compte du boost.

**Risque :** latence ou nombre de buffers qui augmente avec le volume, notamment aux zooms urbains denses.

**Recommandation :** mesurer avec `EXPLAIN (ANALYZE, BUFFERS)` sur des jeux représentatifs et plusieurs bboxes. Vérifier les index réellement présents sur chaque environnement avant toute décision de migration. Les changements de schéma restent soumis à validation humaine.

## 7. Constats importants mais non bloquants

### P2 — Responsabilités encore trop concentrées dans `MapScreen`

Le composant combine dérivation de données, effets, transitions impératives et rendu. Son historique de **66 commits** indique une surface à fort churn. La longueur seule n'est pas une faute, mais elle confirme ici un point de convergence trop large.

**Découpage recommandé :**

- `useMapDeepLinkFocus` ;
- `useMapFilterActions` ;
- `useMapLocationBootstrap` ;
- `useMapSheetCameraSync` ;
- `MapScreenView`, limité au rendu et à des callbacks de haut niveau.

Ce découpage doit préserver les comportements actuels et être réalisé en tickets courts, pas sous forme de réécriture globale.

### P2 — État dupliqué et dérive architecturale

`useMapResultsUIStore` est le store actif, tandis que `useMapResultsStore` expose un second modèle de feuille qui ne présente pas d'usage identifié hors export. Les noms et états diffèrent (`bottomSheetMode`, `sheetStatus`, `bottomSheetEvents`, `sheetEvents`).

**Risque :** un futur développement peut importer le mauvais store et créer deux sources de vérité.

**Recommandation :** confirmer l'absence d'usage externe puis déprécier ou supprimer le store historique dans un ticket dédié.

### P2 — Tri appliqué à plusieurs niveaux

`useViewportEventsFetch.publishFilteredViewport` trie déjà les résultats avant publication. `map.tsx` retrie ensuite `displaySheetEvents` pour les tris autres que `triage`.

**Risque :** travail redondant et divergence future si les deux appels ne reçoivent plus exactement les mêmes paramètres.

**Recommandation :** documenter une seule source responsable de l'ordre de la feuille.

### P2 — Handlers de filtres répétitifs et impératifs

Les changements de date, catégories, meta-filtre et reset suivent une séquence proche : mise à jour du store, lecture via `getState()`, recalcul des filtres, réapplication locale, refresh. Cette duplication rend les règles de commit difficiles à comparer.

**Recommandation :** créer une action unique de transaction de filtres qui retourne l'état final à publier.

### P2 — Temporisations non suivies

- le garde de sélection marqueur utilise un timeout de 400 ms non conservé ni nettoyé ;
- le contrôleur de viewport programme un timeout de sécurité de 4 s non nettoyé ;
- le timeout RPC n'est pas annulé lorsque la RPC répond rapidement.

Ces callbacks écrivent dans des refs ou stores après la séquence d'origine. Le risque est limité, mais inutilement difficile à raisonner.

### P2 — Paramètre `focus` traité une seule fois par montage

`focusHandledRef` passe à `true` au premier paramètre reçu et n'est pas réinitialisé lorsque l'identifiant change. Si Expo Router réutilise le montage pour un second événement, le nouveau focus peut être ignoré.

**Recommandation :** mémoriser le dernier ID traité plutôt qu'un booléen.

### P2 — Souscriptions Zustand trop larges

Le store discovery est correctement sélectionné propriété par propriété. En revanche, localisation, favoris, likes et résultats UI sont déstructurés depuis le store complet. Tout changement de ces stores peut provoquer un rendu de `MapScreen`.

**Recommandation :** utiliser des sélecteurs fins et des ensembles pré-calculés lorsque cela réduit réellement les rendus mesurés.

### P2 — Dette lint dans le contrôleur de viewport

`map.tsx` ne produit lui-même aucun avertissement lint, mais son contrôleur direct `useMapViewportController` en produit huit : deux variables inutilisées et six callbacks dont les dépendances déclarées ne satisfont pas `react-hooks/exhaustive-deps`. Les refs concernées sont probablement stables dans l'usage actuel, mais cette hypothèse n'est ni explicitée ni garantie par l'API du hook.

**Risque :** fermeture obsolète lors d'une future évolution du contrôleur, ou avertissements importants noyés dans le bruit global du lint.

**Recommandation :** corriger ou justifier localement chaque dépendance après ajout des tests de transitions ; ne pas désactiver la règle globalement.

### P2 — Animation de marqueur sélectionné à surveiller

`MapWrapper` relaie la taille animée du marqueur sélectionné vers un état React via `runOnJS`. Une mise à jour par frame peut provoquer des passages répétés sur le pont JS et des regroupements de sources.

**Recommandation :** profiler sur appareil bas/milieu de gamme et préférer une animation entièrement native ou une couche dédiée si le coût est visible.

### P2 — Erreurs et accessibilité dynamiques incomplètes

- l'erreur de viewport est visible, l'échec de chargement détaillé d'un marqueur reste un `console.warn` ;
- le chargement et la bannière d'erreur ne sont pas annoncés comme régions dynamiques ;
- aucun texte n'explique l'absence de position ;
- le style `loadingContainer` paraît inutilisé.

**Recommandation :** unifier les erreurs récupérables, ajouter les annonces pertinentes sans surcharger le lecteur d'écran et supprimer les styles morts après confirmation.

### P2 — Contrastes à valider sur la charte claire

La bordure du bouton de filtre et l'indicateur de poignée utilisent du blanc translucide sur des surfaces potentiellement claires. La charte avertit précisément contre les puces ou contrôles blanc-sur-blanc.

**Recommandation :** valider visuellement les états normal, actif, pressé et disabled sur iOS/Android, puis remplacer les valeurs littérales par un token de bordure adapté si nécessaire.

## 8. Analyse de scalabilité

### 8.1 Ce qui scale raisonnablement

- charge par viewport bornée ;
- charge de liste bornée et virtualisée ;
- payload card-lite ;
- jointures après limitation ;
- clustering des marqueurs ;
- filtres client réappliqués sans réseau sur le dernier payload ;
- réponses obsolètes neutralisées ;
- index partiels alignés avec `published/public`.

### 8.2 Ce qui limite la scalabilité

- un seul cache brut du dernier viewport, non indexé par bbox/filtres ;
- requêtes identiques ou voisines non dédupliquées durablement ;
- absence d'annulation réelle ;
- fallback potentiellement concurrent avec la RPC en timeout ;
- deux agrégats corrélés par ligne de RPC ;
- plafond de 1 500 marqueurs encore significatif pour le payload et la reconstruction de sources ;
- tri potentiellement doublé ;
- stats de cartes chargées pour toute la liste visible ;
- aucune preuve de budget mémoire, FPS, payload ou p95 serveur.

### 8.3 Budgets recommandés à valider

Ces objectifs doivent être confirmés par le Product Owner et la QA :

| Mesure | Budget initial proposé |
|---|---:|
| p95 RPC viewport, bbox urbaine représentative | < 500 ms |
| Payload viewport courant | < 500 Ko compressé |
| Résultats feuille rendus initialement | ≤ 6 |
| FPS pendant drag feuille et pan carte | ≥ 50 sur appareil cible milieu de gamme |
| Requêtes viewport simultanées utiles | 1 par clé bbox/filtres |
| Délai d'affichage d'un état récupérable | < 5 s |

Les recommandations d'optimisation Supabase demandent de vérifier les plans d'exécution et l'utilisation effective des index, pas seulement leur présence dans les migrations : <https://supabase.com/docs/guides/database/query-optimization>.

## 9. Plan de réduction du risque

### Ticket 1 — Tests de transitions critiques (`P1`)

- modéliser explicitement les états `browsing`, `loading`, `viewportResults`, `singleEvent` ;
- tester sélection, gel, restauration, pan, focus et changement de filtres ;
- simuler requêtes lentes, ordre inversé des réponses et retry ;
- couvrir refus de permission et absence de bounds.

### Ticket 2 — Fiabiliser le transport viewport (`P1`)

- dédupliquer les requêtes en vol ;
- nettoyer tous les timers ;
- éviter RPC + fallback concurrents lorsque possible ;
- instrumenter latence, timeout, fallback, taille de payload et résultat ;
- ajouter un cache bbox/filtres avec stratégie stale-while-revalidate bornée.

### Ticket 3 — UX de localisation (`P1`)

- rendre le refus explicite mais non bloquant ;
- proposer réessai/réglages ;
- expliquer le centre par défaut ;
- vérifier la recherche manuelle sans GPS.

### Ticket 4 — Décomposer `MapScreen` (`P2`)

- extraire deep-link, filtres, bootstrap localisation et synchro caméra/feuille ;
- conserver une API de vue réduite ;
- éviter toute réécriture fonctionnelle simultanée ;
- comparer les traces avant/après.

### Ticket 5 — Nettoyage et cohérence (`P2`)

- retirer le store carte historique après confirmation ;
- supprimer le double tri ;
- remplacer `focusHandledRef` par le dernier ID traité ;
- resserrer les sélecteurs Zustand ;
- supprimer styles morts et types `any` aux frontières Mapbox lorsque possible.

### Ticket 6 — Preuve de capacité Supabase (`P2`, validation humaine)

- mesurer les bboxes pays, région, agglomération et quartier ;
- comparer 100, 500, 1 000 et 1 500 résultats ;
- capturer `EXPLAIN (ANALYZE, BUFFERS)` ;
- vérifier les index effectifs et le coût des agrégats d'engagement ;
- ne proposer une migration qu'à partir des mesures et après validation humaine.

## 10. Matrice minimale de validation

| Scénario | Résultat attendu |
|---|---|
| Ouverture avec GPS accordé | centrage utilisateur puis un viewport cohérent, sans double flash |
| Ouverture sans GPS | centre par défaut expliqué, recherche manuelle disponible |
| Pan rapide répété | seule la dernière réponse affecte l'UI, trafic borné |
| Sélection rapide A puis B | B reste actif même si A répond après |
| Ouverture puis fermeture fiche | liste et compteur gelés sont restaurés |
| Drag feuille pendant déplacement carte | caméra stable, pas de boucle de synchronisation |
| Changement de filtre pendant chargement | résultat final conforme au dernier filtre |
| Retour vers l'onglet | feuille et viewport dans un état autorisé |
| Deux paramètres `focus` successifs | chaque nouvel ID est traité une fois |
| RPC lente ou absente | fallback unique, état utilisateur récupérable |
| 1 500 événements proches | clustering fluide et mémoire maîtrisée |
| Lecteur d'écran | actions, chargement, erreur et alternative liste compréhensibles |

## 11. Conclusion

`map.tsx` n'est pas un fichier amateur : il contient de nombreux garde-fous issus d'un vrai travail de stabilisation. Sa faiblesse est désormais structurelle. Les comportements critiques sont trop nombreux à converger dans le même composant et trop dépendants d'un ordre implicite entre refs, stores, timers et callbacks.

La prochaine étape rentable n'est pas une refonte visuelle ni une réécriture complète. Il faut d'abord rendre les transitions testables, borner réellement les requêtes concurrentes, traiter proprement l'absence de localisation et établir des mesures de capacité. Une fois ces protections présentes, le découpage progressif de `MapScreen` pourra réduire le coût des futurs changements sans fragiliser le MVP.

## 12. Vérifications de l'audit

- `npm run typecheck` : succès, aucune erreur TypeScript ;
- `npm run lint` : succès avec 73 avertissements existants et aucune erreur ;
- `npm test` : succès, 78 tests réussis, dont les contrats de filtres et utilitaires de bounds ;
- périmètre carte du lint : aucun avertissement dans `map.tsx`, huit dans `useMapViewportController` et deux imports inutilisés dans `SearchResultsBottomSheet` ;
- recherche de tests directs : les utilitaires carte sont partiellement couverts, mais aucun test identifié pour l'écran ou ses contrôleurs critiques ;
- `git diff --check` : succès ;
- aucun build applicatif lancé, conformément à la règle des changements documentaires.
