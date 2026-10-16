# CATEGORY-COVERS-001 — Couvertures illustrées par catégorie

Demande du 9 octobre 2026. Branche `design/category-covers-001`.

Livrable : dix nouvelles illustrations PNG horizontales 1536 × 1024, une par catégorie
canonique de `src/constants/category-visuals.ts`. Style inspiré des illustrations
`public/images/discover/source-posters.webp` et `source-word-of-mouth.webp` du dépôt du site.
La première image Arts & Culture sert aussi de référence de collection pour les suivantes.
Palette menthe/encre/anis, accents terre et baie, scènes locales chaleureuses, aucun texte intégré.

- Ouvrir `index.html` pour la galerie et les aperçus de recadrage 16:9 / carré.
- Les PNG sont les originaux générés, sans compression de livraison supplémentaire.
- `prompts.json` contient les prompts exacts et les chemins des sorties de l’outil image_gen intégré.
- `manifest.json` contient dimensions, tailles et SHA-256 des dix fichiers.

Contrôles : inspection visuelle des dix sorties ; signatures PNG, dimensions 1536 × 1024,
correspondance des dix slugs et unicité des empreintes vérifiées par script Python en lecture.
Aucun code applicatif modifié : typecheck, lint et build non exécutés.

Les couvertures actuellement utilisées ont été repérées dans le dépôt du collecteur,
`Moments-Locaux-Scrapper/assets/category-covers/`. Ces nouveaux fichiers restent dans le dépôt
mobile pour revue et livraison ; aucune image existante ni donnée distante n’a été remplacée.
Suite éventuelle : décider de leur mise en service, optimiser le format de diffusion et vérifier
le recadrage dans les surfaces qui consomment les couvertures. Les scènes sont génériques et
ne représentent pas les événements réels.
