# Revue MAP-MARKERS-001

Voir le [ticket](../../project-management/roadmap/MAP_CATEGORY_MARKERS.md) pour l’analyse, les choix techniques, les limites et la suite.

## Captures navigateur

Les captures `map-*.png` sont un banc de revue Mapbox GL JS avec de vraies tuiles, dix événements fictifs à Lyon et les assets/dispositions/regroupements importés du code de l’app. L’habillage est celui du banc de revue, **pas une capture de l’écran React Native**.

- `collection.png` : les dix illustrations, leurs couleurs et leur taille réelle de 48 points.
- `map-before.png` : anciens pins, mêmes coordonnées/caméra.
- `map-all-categories.png` : les dix nouvelles silhouettes sur fond routier, canvas 48 points.
- `map-satellite.png` : même collection sur fond satellite.
- `map-pilots.png` : historique de la première itération à trois catégories.
- `map-selected.png` : même image agrandie, pas de halo.
- `map-dense-1500.png` : 1 500 événements, les dix catégories illustrées.
- `map-cluster.png` : 36 événements Gastronomie regroupés.
- `verification.json` : alpha/densités des trente PNG, palette exhaustive, taps sur les dix catégories, sélection, hitbox, changement de zone, repli, clusters et rendu satellite. Deux passages alternés de pan/zoom à 1 500 événements : médiane 16,7 ms et p95 16,8 ms avant/après. Ce sont des mesures RAF, pas du GPU ni une certification sur téléphone.

Le rendu volumique est généré avec imagegen intégré ; les cartes/captures sont rendues par Mapbox. [Prompts pilotes](image-prompts.md), [prompts des sept autres catégories](prompts-extension.json), [palette et contrat de préparation des assets](../../assets/map-markers/README.md). `prepare-asset.cjs` réduit les originaux et réencode les PNG sans perte, sans changer leur dessin.

## Reproduire le banc navigateur

Depuis la racine du dépôt, avec `esbuild` et `playwright-core` disponibles (installés hors des dépendances applicatives pour cette revue) :

```sh
NODE_PATH=/private/tmp/avatar-builder-tools/node_modules node audits/map-category-markers/verify.cjs
```

Chrome est utilisé depuis `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Le serveur HTTP écoute uniquement sur loopback, lit uniquement le token Mapbox public depuis `.env`, et n’enregistre jamais le token dans les preuves. Les sprites des anciens pins sont capturés depuis `CategoryEventMarker`, pas redessinés pour la comparaison.

## Banc natif

`native.jsx` est une entrée Metro QA autonome, pas une route produit. Elle monte le **vrai `MapWrapper`** et ses composants d’images/sources/couches avec des données de démonstration. Le callback de tap affiche ID et compteur ; il ne monte pas tout le parcours fiche/auth de l’app. Boutons : dix catégories, 1 500 événements, clusters. Les appels serveur métier ne sont pas utilisés.

Compilation iOS Simulator effectuée avec succès lors de l’itération pilote depuis le workspace existant, sans changement de configuration native ni signature. Le bundle Metro des dix catégories est également généré avec succès. **La validation visuelle et tactile native automatisée est bloquée par le dialogue système de localisation**, même après tentative de préconfiguration via `simctl privacy`. Aucune capture de ce dialogue n’est présentée comme preuve de rendu. Reproduction pour recette manuelle :

```sh
xcodebuild -workspace ios/MomentsLocaux.xcworkspace -scheme MomentsLocaux -configuration Debug -destination 'platform=iOS Simulator,id=A682837B-3F5E-4B0D-A075-0EA2D803DFCE' -derivedDataPath /private/tmp/map-marker-native CODE_SIGNING_ALLOWED=NO build
npx expo start --dev-client --localhost --port 8087
xcrun simctl install booted /private/tmp/map-marker-native/Build/Products/Debug-iphonesimulator/MomentsLocaux.app
xcrun simctl launch --terminate-running-process booted com.momentslocs.app --initialUrl 'http://localhost:8087/audits/map-category-markers/native.bundle?platform=ios&dev=true&minify=false&disableOnboarding=1'
```

Adapter l’identifiant du simulateur à l’installation. Paramètre du bundle `&reviewMode=selected`, `dense`, `clusters` ou `satellite` pour contrôler un état au démarrage. Répondre manuellement au dialogue de localisation ; les données de démonstration utilisent des coordonnées fixes. Tester les taps directement dans le simulateur, puis sur un iPhone et un Android ; ne pas assimiler une capture de sélection forcée à un test du geste natif.
