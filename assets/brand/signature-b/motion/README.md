# Signature B — Atelier du mouvement

Référence locale **BRAND-SIGNATURE-B-002**, suite de BRAND-SIGNATURE-B-001 / MVP-P1-007.
Demande produit du 6 novembre 2026. Branche `design/brand-signature-b-motion`.

## Ouvrir

Ouvrir `index.html` directement dans un navigateur. Tout fonctionne hors ligne : HTML, CSS,
JavaScript et SVG locaux, sans bibliothèque ni installation. La galerie parente propose aussi
un lien « Voir les animations ».

## Trois gestes

| Variante | Durée à 1× | Comportement |
|---|---|---|
| La signature | 2 050 ms | Tracé original de 1 700 ms, puis arrivée de 350 ms : petit point devant la flèche et une seule onde fine ; les deux disparaissent. Une lecture. |
| Le passage | 2 800 ms | Logo entier fixe ; un trait plus clair parcourt la boucle puis la diagonale ; repos en fin de cycle. Seule cette variante boucle. |
| L’élan | 440 ms | Partie anis déplacée de 0,42 unité SVG vers le haut à droite, puis ramenée à sa position d’origine. Une lecture, à rejouer au toucher. |

La signature a volontairement un tracé progressif sans rebond de toute la forme : la boucle
porte déjà le détour. L’élan d’interaction explore séparément un mouvement très court.
Les chemins sont ceux du symbole choisi, avec son accent séparé en trajet et pointe pour
les animer indépendamment. À l’arrêt final, les tirets sont retirés : la géométrie et les couleurs
sont identiques au SVG statique. La version sombre utilise l’encre inversée de `mark-reverse.svg`.
L’arrivée est uniquement une ponctuation de la signature : point anis de rayon 0,72 à
`(29.2, 3.8)` dans le viewBox 32 × 32 ; onde de rayon 0,9 à 2,5, épaisseur 0,22.
Tout disparaît à 2 050 ms et reste masqué en réduction des animations. La boucle de chargement
ne joue pas d’arrivée ; une future intégration la déclenchera seulement sur un succès réel.
Le nom sous le symbole est du texte système pour cette étude ; les wordmarks exportés restent
les références vectorielles Plus Jakarta Sans pour l’intégration définitive.

## Commandes

- Choisir une des trois variantes, lire/pause, rejouer.
- Déplacer le curseur pour examiner un instant précis (met en pause).
- Ajuster la vitesse à 0,65×, 1× ou 1,35× ; la durée affichée est ajustée.
- Tester sur fond menthe ou encre.
- Activer « Réduire les animations » pour afficher le logo fixe. La préférence système
  `prefers-reduced-motion` est prioritaire et ne peut pas être contournée par la démo.
- Une page masquée suspend la lecture ; revenir reprend uniquement une lecture qui était active.

## Fichiers et suite

- `index.html` : atelier interactif accessible au clavier, aperçu responsive.
- `motion.css` : palette menthe / encre / anis, mise en page bureau/mobile.
- `motion.js` : un seul moteur `requestAnimationFrame`, tracé via `stroke-dashoffset`,
  translations du groupe anis et fondu du nom. Aucun appel réseau ou backend.

Prototype isolé : aucune route, icône active, configuration ni dépendance mobile modifiée.
L’intégration React Native SVG + Reanimated est une étape distincte après choix du rythme.
L’animation d’ouverture serait jouée après le splash natif, sans attendre sa fin pour rendre
l’app utilisable. Le passage accompagne un chargement réel, sans simuler de pourcentage.

## Validation réalisée

- `node --check assets/brand/signature-b/motion/motion.js` : succès.
- `git diff --check` : succès.
- Chrome headless réel : fin de signature, identité des longueurs de tracés avec le SVG B
  source, curseur/pause/reprise, impulsion et boucle, vitesse, fond encre, fin de l’élan : succès.
- Réduction manuelle et préférence système émulée, y compris au chargement : logo fixe.
- Largeurs 320, 390, 620, 768 et 1 440 px : aucun débordement horizontal.
- Aucune erreur JavaScript/console relevée. Captures bureau et mobile inspectées.
  Aperçu bureau : [preview-desktop.png](preview-desktop.png).
- Arrivée : point et onde visibles à 89 % du déroulé, absents à la fin et en mode sans
  mouvement ; inspection sur fonds clair/encre. [Aperçu de l’arrivée](preview-arrival.png).

Pas de typecheck/lint/build mobile relancé : seuls le prototype navigateur, son accès depuis
la galerie et sa documentation sont modifiés. Rendu et performances sur appareils natifs
à vérifier lors de l’intégration React Native ; aucun export Lottie/vidéo dans cette étude.
