# Moments Locaux — Signature B

Référence **BRAND-SIGNATURE-B-001**, suite de PROPOSALS-ICON-001 / MVP-P1-007.
Choix utilisateur du 6 novembre 2026 : variante centrale « Signature en mouvement ».
Branche : `design/brand-signature-b-assets`.

Ce pack conserve exactement la géométrie B : M arrondi, boucle, diagonale montante et
flèche ouverte. L’intégration B-003 installe cette marque dans l’app et les ressources natives.
Les captures stores et déclarations de publication restent une étape de release.

## Où prendre les fichiers

| Dossier | Contenu / usage |
|---|---|
| `symbols/` | Symbole seul : SVG, PDF et PNG 256/512/1024, fond transparent |
| `logos/` | Logo avec nom horizontal et empilé : SVG/PDF vectoriels, PNG 1×/2× transparents |
| `app-icons/` | Carrés opaques 512/1024 sur fond menthe, blanc ou encre ; foreground/background adaptatifs Android ; masque monochrome Android |
| `ui/` | Propositions actif, inactif, désactivé, fond sombre : SVG et PNG de 20 à 96 px |
| `web/` | Favicon SVG, PNG 16/32/48, ICO multi-résolution ; touch/PWA 180/192/512 |
| `social/` | Avatars carrés 400/800 et visuel de partage 1200×630 |
| `splash/` | Symbole transparent 512/1024 et carré menthe 1024/2048 pour composer un splash responsive |
| `preview/` | Planche récapitulative SVG et PNG 1200×950 |
| `source/` | Exporteurs reproductibles Swift/Python et licence de la police |

La galerie `index.html` s'ouvre directement dans un navigateur. Inventaire machine : `manifest.json`.
L'archive complète se trouve un niveau au-dessus : `../moments-locaux-signature-b.zip`.

## Animations — prototype B-002

Ouvrir [l’atelier du mouvement](motion/index.html) pour comparer la signature avec point et onde d’arrivée (2,05 s),
le passage en boucle (2,80 s) et l’élan au toucher (0,44 s). Réglage de vitesse,
curseur de lecture, fond encre et réduction des animations disponibles.
[Logique et paramètres](motion/README.md). Prototype navigateur isolé, sans intégration mobile.
L’archive ZIP ci-dessus reste le pack d’assets statiques B-001 ; ce prototype se trouve dans le dépôt.

Intégration native B-003 : `AnimatedBrandMark` pour Accueil/démarrage/spinners, `BrandMark`
statique pour l’onboarding et Propositions (traitement **leaf**). Icônes, splash, connexion
et avatars de marque alignés. [Périmètre et vérifications](../../../audits/brand-signature-native/README.md).

## Couleurs et variantes

- `color` : encre #1A3329 + anis #7CB518, à utiliser sur fond clair.
- `reverse` : menthe #F4FBF6 + anis, pour fond sombre.
- `ink` / `white` / `black` / `leaf` : une couleur, pour masques et usages monochromes.
- Les fichiers blancs sont transparents : les inspecter sur fond sombre, pas sur blanc.
- Texte : Plus Jakarta Sans Bold, déjà utilisé dans le projet ; converti en tracés dans les
  SVG/PDF et rendu avec la même police dans les PNG. Aucune dépendance à une police installée.

Tous les fichiers sont sRGB/RGB, pas des fichiers CMJN certifiés pour imprimerie.
Pas d'étirement, d'ajout d'étoiles, d'ombre ou de gradient. Garder au minimum 1/8 de largeur
du symbole comme espace libre autour de sa boîte. Contrôler la lisibilité aux tailles 16–20 px.
La boucle est volontairement conservée ; le 16 px est surtout destiné aux favicons.

## Application et web

- Icône iOS proposée : `app-icons/app-icon-mint-1024.png`, sans alpha, sans coins arrondis cuits.
- Icône Play proposée : `app-icons/app-icon-mint-512.png`.
- Android adaptatif : foreground transparent + background menthe ; symbole contenu dans
  la zone centrale 66/108. `android-themed-monochrome` est le masque dédié, non un logo noir opaque.
- AppIcon iOS et ressources Android sont installés par `source/InstallApp.py`. Xcode génère
  les tailles intermédiaires iOS. Configuration Expo et projets natifs suivis sont alignés.
- UI : taille logique 24 → PNG 24/48/72 ; taille logique 28 → PNG 28/56/84 ;
  taille logique 32 → PNG 32/64/96. Le SVG reste préférable pour l'app.
- Splash : images de composition ; adapter aux safe areas et à chaque format d'écran.
- PWA : fichiers fournis ; favicon Expo remplacé, manifest PWA dédié non modifié.
- Aucune déclaration de conformité finale stores/print : vérifier le binaire et les masques réels.

## Régénération et contrôles

Depuis la racine du dépôt, sous macOS avec Swift et les dépendances npm existantes :

```sh
swift -module-cache-path /private/tmp/brand-b-swift-cache assets/brand/signature-b/source/Generate.swift
python3 assets/brand/signature-b/source/Package.py
```

Les scripts n'appellent aucun service externe. Génération native CoreGraphics pour les PNG,
CoreText pour les contours typographiques ; pas de capture navigateur redimensionnée.
Package.py vérifie les dimensions/alpha des PNG, la validité XML et l'absence de texte vivant
dans les SVG, puis crée l'ICO et l'archive et contrôle son intégrité.

Installer/régénérer les ressources actives de l’app (macOS), puis contrôler leurs empreintes :

```sh
python3 assets/brand/signature-b/source/InstallApp.py
python3 assets/brand/signature-b/source/InstallApp.py --check
```

Ce script réutilise les fonctions vectorielles de `Generate.swift`, installe les PNG et les
variantes natives et écrit `audits/brand-signature-native/installed-assets.json`. Il conserve
les anciens fichiers Android sous leurs anciens noms, devenus inactifs dans le manifest.
Un nouveau build natif est nécessaire pour voir les icônes et le splash.

Inspection visuelle : logo horizontal, icône d'application et planche récapitulative.
Le contrôle des masques natifs, captures stores et accessibilité dans les écrans sera réalisé
à l'intégration. Aucun build, typecheck ou lint de l'app nécessaire pour ces seuls fichiers graphiques.
