# BRAND-SIGNATURE-B-003 — Accueil et démarrage natifs

Demande produit du 6 novembre 2026, suite des assets B-001 et du prototype B-002.
Branche `feat/brand-signature-b-native`, rattachement MVP-P1-007.

## Comportement livré

- `HomeHeader` : une ligne compacte M-flèche de 36 px + Moments Locaux en Plus Jakarta Sans,
  au-dessus de la rangée bonjour/avatar. Profil, Lumia, notifications et recherche conservés.
- Au premier focus de l’Accueil dans le runtime JS : trajet de 1 700 ms + arrivée de 350 ms.
  Point et onde s’effacent, logo complet fixe ensuite. Une valeur en mémoire empêche les
  relectures lors des remontages, retours d’onglet ou reconnexions. Un rechargement JS ou un
  redémarrage de l’app recrée ce contexte ; aucune persistance disque ajoutée.
- Quitter l’Accueil ou mettre l’app en arrière-plan pendant la signature l’arrête et affiche
  le logo complet. Le retour ne rejoue pas une signature interrompue.
- `BrandStartupScreen` : symbole de 96 px et passage de 2 800 ms en boucle pendant les
  attentes déjà présentes. Le logo reste entier, le reflet parcourt le chemin ; aucune arrivée
  de succès dans ce chargement indéterminé.
- Même écran pendant le chargement des polices (`app/_layout.tsx`), la restauration Auth/profil
  (`app/index.tsx`) et l’attente Auth de la pile d’onglets. Les conditions d’authentification
  ne changent pas. Sur demande produit, le root conserve désormais cet écran **3 secondes
  minimum depuis son premier layout visible**, pour voir un passage entier. Les polices,
  l’Auth et les caches s’initialisent en parallèle. Si l’initialisation est plus longue, seules
  les attentes réelles restent affichées après ce minimum.
- `useColdStartPresentation` conserve en mémoire la deadline et la fin de présentation :
  retour d’arrière-plan, changement d’onglet ou remontage React ne créent pas de nouveau minimum.
  Une mise en arrière-plan pendant la présentation la consomme immédiatement ; aucune relecture
  au retour. Seul un processus/runtime JS neuf recrée le démarrage à froid. Un rechargement Metro
  complet en développement recrée aussi ce contexte, contrairement à une simple reprise.
- Réduction des animations : aucun délai minimum décoratif. Les notifications conservent leur
  intention en attente jusqu’au montage effectif de Stack après la présentation.
- Réduction des animations : logo complet fixe. Le hook est initialisé avec la préférence
  synchrone Reanimated, puis suit `AccessibilityInfo` pour les changements à chaud.
- Seuls des attributs SVG sont animés sur le thread UI par Reanimated. Aucune nouvelle
  dépendance, vidéo, WebView ni requête réseau pour le logo.
- Extension de la même demande : onglet et tiroir Propositions = M **leaf** (tout anis),
  avec le même tracé que `symbols/mark-leaf.svg`. Le chrome d’onglet conserve la sélection.
- Connexion (`icon.png`), en-tête onboarding (SVG couleur), tous les `BrandLogoSpinner`,
  avatars de la plateforme dans les événements/notifications, favicon, icônes stores et
  splashs natifs utilisent Signature B. Les vrais avatars de membres et organisateurs tiers
  sont conservés. Les glyphes sparkles décoratifs d’autres rubriques ne représentent pas la marque.
- Les URL distantes de marque ne sont plus prioritaires : avatar local dans la provenance,
  absence d’avatar distant pour les visuels d’événements Moments Locaux dans l’inbox,
  reconnaissance de l’ancienne URL Storage dans les visuels en cache.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/components/ui/AnimatedBrandMark.tsx` | Géométrie SVG, tracé/onde/reflet, réduction et cycle de vie |
| `src/constants/brand-mark.ts`, `src/components/ui/BrandMark.tsx` | Géométrie commune, variantes statiques couleur et leaf |
| `BrandIcon`, `brand-icon-artwork`, `app/(tabs)/_layout.tsx` | M leaf dans l’onglet et le tiroir Propositions |
| `BrandLogoSpinner`, `OnboardingScreen`, `assets/images/*` | Adoption dans les surfaces partagées, onboarding et connexion |
| `branding`, `EventDetailScreen`, `NotificationsInboxScreen`, `notifications.service` | Marque locale dans la provenance et les notifications |
| `app.config.ts`, `app.json`, `ios/…`, `android/…` | Icônes et splashs natifs, références Expo et manifest Android alignées |
| `src/components/home/HomeBrandSignature.tsx` | Déclenchement au focus, une seule signature par runtime |
| `src/components/home/HomeHeader.tsx` | Insertion de la ligne de marque |
| `src/components/ui/BrandStartupScreen.tsx` | Présentation commune du démarrage ; police système avant `useFonts` |
| `src/hooks/useReduceMotion.ts` | Valeur initiale facultative ; comportement existant conservé par défaut |
| `src/hooks/useColdStartPresentation.ts` | Minimum visible de 3 s, une fois par runtime ; interruption/arrière-plan et réduction des animations |
| `app/_layout.tsx`, `app/index.tsx`, `app/(tabs)/_layout.tsx` | Réutilisation sur les trois attentes existantes |
| `NativeReview.tsx` | Aperçu isolé des composants réels avec navigation, sans backend, hors Expo Router |

La charte, la liste des tickets et le guide des assets sont mis à jour. Le prototype B-002
préexistant est conservé. Les permissions, les migrations et le backend sont inchangés.
Les anciens fichiers launcher Android restent présents pour conserver l’historique ; le
manifest actif référence les nouvelles ressources B (legacy, adaptatif et monochrome API 33+).

Installation reproductible depuis les vecteurs, avec génération directe aux tailles natives :

```sh
python3 assets/brand/signature-b/source/InstallApp.py
python3 assets/brand/signature-b/source/InstallApp.py --check
```

Les 30 ressources installées et leurs empreintes sont dans `installed-assets.json`.
Les icônes stores sont opaques ; les foregrounds/splashs gardent leur transparence. Un nouveau
build natif est nécessaire pour voir l’icône du téléphone et le splash ; Metro seul ne les met pas à jour.

## Vérifications

- `npm run typecheck` : succès.
- `npm run lint` : succès, 0 erreur et 42 avertissements dans les fichiers existants ; aucun
  avertissement sur les nouveaux composants ni sur les fichiers applicatifs modifiés.
- `git diff --check` : succès.
- `npm test` : succès, 488 tests de filtres/utilitaires/stores, 18 hearts, 2 scanner secrets.
- `npx expo config --type public --json` : succès ; sortie sensible conservée uniquement dans
  `/private/tmp`, sans reproduction. Icônes adaptatives et plugin splash contrôlés.
- `InstallApp.py --check` : 30 ressources conformes ; dimensions/alpha, XML, références
  manifest/adaptive-icon et imageView/asset iOS contrôlés.
- Chrome headless, composants réels compilés par Metro et navigation React Navigation réelle :
  tracé initial, point/onde visibles en fin de course, disparition à la fin ; remontage et retour
  d’onglet sans relecture ; sortie pendant la signature sans relecture au retour ; actions profil,
  Lumia, notifications et recherche fonctionnelles ; écran de démarrage ; réduction des animations
  dès le chargement. Aucun crash JavaScript relevé. Largeurs 320/390/430 px sans débordement.
- Captures inspectées : [Accueil](home-web-390.png), [démarrage](startup-web-430.png).
- Extension globale : M Propositions entièrement leaf vérifié sur les composants réels aux
  tailles 22/28/36 px ; [aperçu](proposals-leaf-web.png). Navigation, commandes et réduction
  des animations revérifiées après remplacement du spinner partagé : succès, sans erreur JS.
- Minimum au démarrage : **3 105 ms observés** entre l’apparition de l’écran et l’Accueil,
  avec le hook réel dans l’aperçu. Remontage du cadre complet, retour d’arrière-plan et mise
  en arrière-plan pendant la présentation vérifiés via les onglets Chrome réels : aucune
  nouvelle attente de 3 s. Réduction des animations au démarrage vérifiée (logo fixe).
  Typecheck/lint et les 508 tests ont été relancés avec succès après cette évolution.
- Compilation iOS Debug simulateur : `BUILD SUCCEEDED`, signature désactivée pour cette recette.
- Compilation iOS répétée après remplacement AppIcon/splash : `BUILD SUCCEEDED`.
- Build installé et entrée de revue chargée sur iPhone 17 Pro / iOS 26.5 : géométrie et en-tête
  natifs visibles. Un dialogue système de liens provenant de la tentative d’ouverture précédente
  recouvre une partie de l’aperçu : ce contrôle ne constitue pas une recette tactile iOS complète.

Commande de compilation utilisée :

```sh
xcodebuild -workspace ios/MomentsLocaux.xcworkspace -scheme MomentsLocaux \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=A682837B-3F5E-4B0D-A075-0EA2D803DFCE' \
  -derivedDataPath /private/tmp/brand-signature-native CODE_SIGNING_ALLOWED=NO build
```

L’aperçu est servi par Metro avec une entrée dédiée :

```sh
EXPO_NO_TELEMETRY=1 npx expo start --dev-client --localhost --port 8094
```

Bundle de revue :
`http://localhost:8094/audits/brand-signature-native/NativeReview.bundle?platform=ios&dev=true&minify=false`.
Le même chemin avec `platform=web` sert l’aperçu navigateur ; celui-ci nécessite un conteneur
HTML `#root` et le routage des assets `/assets/*` vers Metro.

Pour le client de développement iOS, servir un manifeste Expo local dont `launchAsset.url`
est ce bundle de revue, puis utiliser `simctl launch … com.momentslocs.app --initialUrl <URL-du-manifeste>`.
Les outils temporaires de cette recette sont sous `/private/tmp/brand-native-*` ; aucune entrée
de revue n’est ajoutée aux routes du produit.

## Recette complémentaire

Avant distribution : appareil iOS/Android, réduction des animations activée/désactivée à chaud,
interruption par notification, passage arrière-plan/reprise, taille de texte augmentée, cold start
rapide/lent et retours depuis une fiche événement. Android non exécuté ici (pas de SDK/émulateur
accessible). Cette compilation Debug ne valide pas une signature de distribution ni les stores.
