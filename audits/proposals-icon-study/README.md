# PROPOSALS-ICON-001 — M-flèche

Prototype vectoriel demandé le 6 novembre 2026, déclinaison de MVP-P1-007.
Branche : `design/proposals-icon-study`. Aucun remplacement dans l'application.

Ouvrir `index.html` dans un navigateur, ou lancer depuis la racine :

```sh
python3 -m http.server 8093
```

Puis visiter http://localhost:8093/audits/proposals-icon-study/.
Les boutons de comparaison changent l'icône de la maquette de navigation.

## Pistes

- A — M-flèche : silhouette simple, recommandée pour l'onglet.
- B — Signature en mouvement : boucle inspirée du logo, filiation la plus forte.
- C — Cap local : pointe pleine, expression plus directionnelle.

Chaque piste possède ses SVG actif et inactif, avec viewBox 32 × 32 et aperçu aux
tailles 20/24/28/32 px. Formes originales, traits arrondis et couleurs du thème
encre/anis. L'inactif est monochrome ; l'actif colore la diagonale. Cette étude
explore une signature propre à Propositions, différente du rendu rempli des
pictogrammes Duo végétal actuels. Ce choix reste à valider avant intégration.

La référence est `assets/images/logo-mark.png`. L'onglet et le tiroir actuels
utilisent `BrandIcon name="sparkles"` ; ils ne sont pas modifiés.

## Fichiers et validation

- `index.html` : planche autonome, sans requête externe ni bibliothèque.
- `comparison.png` : capture réelle de la planche dans Chrome headless.
- `proposal-{a,b,c}-{active,inactive}.svg` : six assets éditables.
- `build.py` : régénère la planche et les SVG (`python3 audits/proposals-icon-study/build.py`).

Validation : génération réussie, contrôle visuel de la capture desktop, parsing XML
des six SVG, syntaxe JavaScript et contrôle des espaces. Les interactions de la
navigation et le rendu sur appareil natif restent à vérifier avant intégration.
Pas de typecheck/lint/build applicatif relancé : seul le prototype isolé est ajouté.
