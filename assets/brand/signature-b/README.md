# Moments Locaux — Signature B

Référence **BRAND-SIGNATURE-B-001**, suite de PROPOSALS-ICON-001 / MVP-P1-007.
Choix utilisateur du 6 novembre 2026 : variante centrale « Signature en mouvement ».
Branche : `design/brand-signature-b-assets`.

Ce pack conserve exactement la géométrie B : M arrondi, boucle, diagonale montante et
flèche ouverte. Les anciens fichiers et les configurations de l'app ne sont pas remplacés.
L'adoption globale comme nouveau logo et les captures stores seront une intégration distincte.

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
- Les tailles intermédiaires iOS seront générées lors de l'intégration par Expo/Xcode :
  aucune modification d'AppIcon.appiconset ni de configuration n'a été faite ici.
- UI : taille logique 24 → PNG 24/48/72 ; taille logique 28 → PNG 28/56/84 ;
  taille logique 32 → PNG 32/64/96. Le SVG reste préférable pour l'app.
- Splash : images de composition ; adapter aux safe areas et à chaque format d'écran.
- PWA : fichiers fournis, mais manifest web non modifié ; les déclarer explicitement à l'intégration.
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

Inspection visuelle : logo horizontal, icône d'application et planche récapitulative.
Le contrôle des masques natifs, captures stores et accessibilité dans les écrans sera réalisé
à l'intégration. Aucun build, typecheck ou lint de l'app nécessaire pour ces seuls fichiers graphiques.
