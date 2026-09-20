# Les dix catégories Moments Locaux

Ticket : [MAP-MARKERS-001](../../project-management/roadmap/MAP_CATEGORY_MARKERS.md).

Registre applicatif exhaustif : `src/constants/map-marker-assets.ts`. Illustrations 2.5D générées avec imagegen intégré, sans pin ni conteneur. Prompts : [trois premiers assets](../../audits/map-category-markers/image-prompts.md), [sept suivants](../../audits/map-category-markers/prompts-extension.json). Extension autorisée par l’utilisateur après validation des trois pilotes.

## Palette de référence

Couleurs actuellement utilisées, vérifiées en lecture seule dans `event_category` le 2026-09-19. La couleur de catégorie doit dominer l’illustration ; lumière/ombres utilisent ses nuances, accents secondaires discrets.

| Catégorie | Dominante | État |
| --- | --- | --- |
| Arts & Culture | `#7C3AED` | Masques |
| Marchés & Artisanat | `#0EA5E9` | Panier |
| Fêtes & Animations | `#F97316` | Notes de musique |
| Famille & Enfants | `#16A34A` | Ourson |
| Gastronomie & Saveurs | `#FACC15` | Cloche |
| Nature, Bien-être & Écologie | `#22C55E` | Rameau |
| Ateliers & Apprentissage | `#6366F1` | Livre ouvert |
| Sport & Loisirs | `#F43F5E` | Haltère |
| Vie locale & Citoyenne | `#0EA5E9` | Maison de quartier |
| Insolite & Éphémère | `#A855F7` | Étoiles |

## Contrat d’asset

- PNG RGBA, transparence réelle, silhouette centrée avec marge, sans texte ni décor. Objet visible sur environ 82 % du canvas.
- `slug.png` = 64 × 64, `slug@2x.png` = 128 × 128, `slug@3x.png` = 192 × 192. Tous correspondent à un canvas de 64 points pour Metro.
- Affichage normal : canvas de 48 points (`iconSize: 0.75`), sélection × 1.566. Ancre centrée ; hitbox de source 48 × 48 indépendante de l’alpha.
- Ombres/volume précalculés ; pas de shader, modèle 3D, animation ni vue React par événement.
- Ajouter le `require()` statique et `primaryColor` dans le registre. Ne jamais renommer les clés Mapbox historiques ni utiliser une URL distante.
- Si la couleur de taxonomie évolue, régénérer l’illustration et mettre à jour sa référence. Les PNG multicolores ne doivent pas être teintés uniformément.
- Contrôler à taille réelle sur fonds routier et satellite avant généralisation.
- Packaging reproductible : `node audits/map-category-markers/prepare-asset.cjs <slug> <generated.png>` (réduction `sips`, réencodage PNG sans perte, alpha préservé). Les 30 PNG totalisent 422 974 octets.
- Catégorie inconnue : symbole collectif vectoriel vert de marque, sans pin, enregistré une seule fois à 48 points. Les clusters conservent leurs pastilles de comptage et leur couleur de taxonomie.
