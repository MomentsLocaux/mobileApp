# MAP-MARKERS-001 — silhouettes de catégorie sur la carte

Demande produit du 2026-09-19. Branche : `feat/map-category-markers`.

## Base et périmètre

- `main` et `origin/main` vérifiés après fetch : `72f85d2c4f72c252a37b7be3fc21b667c323a158`, aucun écart.
- Reprise le 2026-09-20 : la branche a reçu `main` en fast-forward jusqu’à `6f8db10` (fiche de carte à deux positions). `HEAD`, `main` et `origin/main` correspondent ; travail markers préservé. Ne pas rétablir les anciennes positions de fiche.
- Les deux fichiers non suivis préexistants (preview avatars et template email) ont été conservés dans le stash `pre-map-markers: preserve local avatar preview and email template`. Branche créée depuis un arbre propre.
- Première itération graphique : Gastronomie, Nature, Arts & Culture. Collection désormais étendue aux dix catégories après validation graphique par l’utilisateur.
- Les trois silhouettes ont été validées par l’utilisateur, qui autorise explicitement la poursuite sur les sept autres catégories les 2026-09-19/20. L’extension reste dans ce ticket et cette branche ; la validation des gestes et performances sur téléphones réels reste à distinguer des tests de banc.
- Couleur dominante : couleur actuelle de chaque catégorie dans la taxonomie ; ombres et accents dérivés de cette palette.
- Pas de changement des requêtes, du backend, de la navigation ni du périmètre MVP.

## Critères d’acceptation

1. L’illustration de chacune des dix catégories est elle-même le marker, sans pin générique ; le repli inconnu est également sans pin.
2. Registre central catégorie → asset, utilisé par Découvrir et Favoris.
3. Assets locaux optimisés, sans 3D temps réel ni animation permanente.
4. Tap, sélection, preview, hitbox confortable et clustering préservés.
5. Sources/couches stables lors des changements de zone et de catégorie.
6. Previews sur carte et vérifications avec 1 500 points ; distinguer mesures navigateur et validation native.
7. `npm run typecheck`, `npm run lint`, vérifications ciblées ; parcours de la checklist charte.

## Analyse initiale

`@rnmapbox/maps` 10.2.7 : `Images` partagées par catégorie, `ShapeSource` GeoJSON et `SymbolLayer`. Aucun composant React par événement. Onze sources stables (dix catégories et repli), clustering par catégorie : rayon 42, zoom maximum 15. Couche séparée pour la sélection ; agrandissement existant conservé. La carte Découvrir plafonne les résultats à 1 500 ; fallback liste à 300. Favoris affiche les événements fournis sans plafond propre, sans clustering.

Avant cette modification, `CategoryMarkerImages` capturait des pins SVG dans des images partagées. Les identifiants `category-marker-*` sont également utilisés par les résultats serveur/cache : ils restent inchangés. `useMapMarkerPress` gère cache, chargement et ouverture de preview : ce circuit est conservé.

Référence audit : `audits/wave-2-reliable-mvp/02_SEARCH_MAP_LOCATION_AUDIT.md` (constantes vérifiées dans le code actuel). Référence charte : `docs/CHARTER_UI_SURFACES.md` et `.cursor/rules/charter-ui-surfaces.mdc`.

## Architecture retenue

- `src/constants/map-marker-assets.ts` : registre exhaustif typé `Record<CategoryVisualSlug, MapMarkerAsset>`, catégorie → PNG + couleur dominante, images Mapbox et disposition. Une nouvelle catégorie canonique exige son entrée à la compilation. Ajouter une entrée active l’illustration sur les deux cartes sans toucher leurs gestionnaires ni leurs sources. Le registre canonique `category-visuals` continue de porter les catégories et les clés historiques.
- PNG RGBA locaux en 64/128/192 px (1×/2×/3×), canvas affiché à 48 points, silhouette visible d’environ 40 points. PNG est pris en charge directement par `Mapbox.Images` avec `require()` et conserve les dégradés/ombres/transparence. Les densités Metro conservent la même taille logique. Aucun téléchargement d’illustration à l’exécution.
- Collection : masques Arts, panier Marchés, notes Fêtes, ourson Famille, cloche Gastronomie, rameau Nature, livre Ateliers, haltère Sport, maison Vie locale et étoiles Insolite. Toutes respectent leur dominante de taxonomie, confirmée par SELECT sur `event_category` le 2026-09-19, sans modification de données. Voir la [palette complète et le contrat d’asset](../../assets/map-markers/README.md). Les illustrations ont été générées avec l’outil imagegen intégré. Une future modification de couleur nécessite de régénérer l’asset correspondant, pas de lui appliquer une teinte uniforme qui détruirait le volume.
- Tous les canvas sont ancrés au centre du point géographique. Sélection : facteur historique `1.45 × 1.08`, appliqué à la taille normale. Pas de halo ou nouvelle animation.
- Hitbox de source explicite 48 × 48 (ancienne valeur par défaut 44 × 44), également sur la couche sélectionnée. Mapbox choisit la source touchée ; les callbacks existants reçoivent le même ID. Le tap du marker sélectionné est désormais lui aussi relié au callback existant.
- `CategoryMarkerImages` enregistre les dix PNG via `Images.images` et conserve les onze images de clusters. Repli inconnu : symbole collectif vectoriel vert, sans conteneur, canvas 48 points. Enfants directs `Mapbox.Image`, sans fragments intermédiaires. Dix textures PNG + douze snapshots = 22 images enregistrées, comme auparavant. L’ancien dessin de pin reste disponible uniquement pour la comparaison avant/après du banc.
- Découvrir : mêmes 11 sources groupées, mêmes 34 couches markers/clusters/sélection, mêmes règles de clustering et d’expansion. Favoris : mêmes sources, pas d’ajout de clustering. Aucun changement des RPC, caches, limites, timers, previews/cards, fiches, boutons de carte ou puck natif.

API vérifiée dans la version installée et dans les docs officielles : [Images](https://rnmapbox.github.io/docs/components/Images), [ShapeSource / hitbox](https://rnmapbox.github.io/docs/components/ShapeSource).

## Performances et limites

- Les trente PNG occupent 422 974 octets, soit environ 413 Kio au total. À 3×, les dix textures RGBA représentent environ 1,41 Mio avant surcoût d’atlas/cache ; estimation d’environ 0,69 Mio de plus que les dix anciens snapshots 42 × 50 à 3×. Ce coût dépend du nombre de catégories, pas du nombre d’événements. Il ne s’agit pas d’une mesure de la mémoire GPU totale.
- Aucun composant React, texture distincte, ombre dynamique ou calcul 3D par événement. Pan/zoom restent dans les couches de symboles du moteur Mapbox. Sources stables lors des changements de zone/catégorie.
- Banc navigateur : véritables tuiles Mapbox Streets et Satellite Streets, assets et regroupement importés du code de l’app, dix événements de démonstration puis 1 500 points. Vérifie les trente PNG (alpha/densités), le registre exhaustif et ses couleurs, un tap sur chacune des dix catégories, tap sélectionné, hitbox, sélection, 34 couches stables, changement de zone, repli inconnu, compte et expansion d’un cluster de 36 points, absence d’erreur Mapbox/JS.
- Le banc GL JS reproduit les couches et le hit-test mais ne monte pas l’écran React Native. Il ne certifie donc ni le routage complet vers la fiche, ni les performances iOS/Android. Deux passages alternés avant/après donnent une médiane RAF de 16,7 ms et un p95 de 16,8 ms dans les deux cas pour 1 500 points. Pas de régression observée sur ce banc ; ce n’est pas une certification de fluidité sur téléphone. Premier affichage : 1,53 s, dépendant du réseau/cache des tuiles, sans comparaison avant/après du démarrage.

## Vérifications

- `npm run typecheck` : OK.
- `npm run lint` : 0 erreur, 41 avertissements préexistants, aucun dans les composants modifiés.
- `npm run test:filters` : 322 tests, 0 échec.
- `NODE_PATH=/private/tmp/avatar-builder-tools/node_modules node audits/map-category-markers/verify.cjs` : OK ; tooling installé hors dépôt, aucune dépendance applicative ajoutée.
- Checklist charte parcourue : Découvrir et Favoris partagent les assets ; sélection sans halo ; clusters, puck, chrome, bannières et fiche conservés. Les surfaces modifiées sont documentées dans `CHARTER_UI_SURFACES.md`.
- `git diff --check` et vérification syntaxique des scripts : OK.
- Compilation iOS Simulator : `xcodebuild` réussi lors de l’itération pilote, sans changement de dépendance/configuration native depuis. Bundle Metro de la collection complète réussi. Le banc natif monte le vrai `MapWrapper`, mais le dialogue système de localisation bloque la validation automatisée du rendu et des taps. Aucun succès de geste natif ni capture native n’est revendiqué.

Preuves : [collection](../../audits/map-category-markers/collection.png), [dix catégories sur carte](../../audits/map-category-markers/map-all-categories.png), [satellite](../../audits/map-category-markers/map-satellite.png), [avant](../../audits/map-category-markers/map-before.png), [sélection](../../audits/map-category-markers/map-selected.png), [densité](../../audits/map-category-markers/map-dense-1500.png), [cluster](../../audits/map-category-markers/map-cluster.png), [résultats JSON](../../audits/map-category-markers/verification.json), [prompts pilotes](../../audits/map-category-markers/image-prompts.md), [prompts extension](../../audits/map-category-markers/prompts-extension.json). Ce sont des captures du banc GL JS, pas de l’écran natif.

## Fichiers concernés

- `src/constants/map-marker-assets.ts` : registre, textures et dimensions partagées.
- `src/components/map/{CategoryMarkerImages,CategoryEventMarker,MapWrapper}.tsx` et `src/components/favorites/FavoritesMapView.tsx` : images, repli, ancrage et zone tactile.
- `assets/map-markers/` : trente PNG optimisés et contrat de maintenance.
- `audits/map-category-markers/` : prompts, préparation d’assets, bancs de revue, captures et résultats.
- Ce ticket, `MVP_TICKETS.md` et `docs/CHARTER_UI_SURFACES.md` : suivi et règles de charte.

## Suite de recette

La génération et l’intégration des dix catégories sont terminées. Il reste la recette sur téléphones iOS et Android : taps rapprochés, point déjà sélectionné, fiche/favoris, zoom/dézoom, déplacement, densité maximale, reprise après changement de style. Mesurer temps de frame/mémoire sur appareil peu puissant, à configuration identique avant/après. Aucune décision produit supplémentaire n’est nécessaire pour l’extension réalisée.
