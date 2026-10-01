# SCRUM-290 — Rechercher dans cette zone

`MapSearchAreaControls` remplace le bouton à deux lignes par une capsule leaf
centrée : icône Duo végétal, libellé unique, cible tactile de 44 px minimum.
Le texte peut revenir à la ligne aux grandes tailles sans perdre l'icône.
Les précisions sur la conservation de quoi/quand et le remplacement du lieu
passent dans `accessibilityHint`.

Le bouton affiche un spinner `onAccent` et reste désactivé pendant la lecture
native des bounds ou quand la sheet signale un chargement. Un verrou immédiat
dans le handler protège aussi deux appuis avant le prochain rendu. Après
lancement, l'action disparaît ; le chargement des résultats reste porté par la
sheet. Une nouvelle zone en attente pendant la lecture native n'est pas effacée.
Un échec de lecture affiche une erreur ; fermer cette bannière révèle à nouveau
la capsule pour réessayer. La bannière a priorité sur les actions de zone pour
éviter tout chevauchement.

L'alerte « zone trop large » conserve son action de rapprochement et se place
en flux sous la capsule, sans offset vertical fixe. L'ensemble disparaît avec
l'ouverture de la recherche étendue. Le conteneur `box-none` laisse la carte
recevoir les touches hors des actions.

## Contrat et charte

- Détection du déplacement, limite des bounds, filtres quoi/quand et pipeline
  de recherche conservés. Seul le lieu est effacé par le handler existant.
- Même parent sous le header tenant compte des safe areas ; même couche carte,
  derrière la sheet et la fiche individuelle.
- Relecture de `CHARTER_UI_SURFACES.md`, de la règle Cursor, de `MapChromeActions`,
  `SearchBar` et des surfaces de chargement/sheet voisines. Aucun token global
  changé ; la nouvelle surface est inscrite dans la checklist.

## Vérifications — 30 septembre 2026

- `npm run typecheck` : réussi.
- `npm run lint` : 0 erreur, 42 avertissements préexistants.
- `npm run test:filters` : 378 tests réussis (dont contrats découverte/viewport).
- `npm run test:hearts` : 16 tests réussis, continuité de SCRUM-288.
- `npm run check:secrets` et `git diff --check` : réussis.
- Fixture React Native Web utilisant le **composant réel**, sans données ni réseau
  applicatif : contrôles à 320/390/430 px, cible tactile, absence de débordement,
  action désactivée pendant chargement/zone trop large, rapprochement accessible,
  touches hors capsule transmises au fond. Texte doublé à 320 px : alerte sous le
  libellé, sans chevauchement. Captures `controls-*.png` inspectées.

Reproduire la revue locale avec Chrome installé :

```sh
npm install --prefix /private/tmp/scrum-290-tools --no-package-lock --no-audit --no-fund esbuild playwright-core
node audits/scrum-290/build.cjs
node audits/scrum-290/verify.cjs
```

La fixture valide le composant isolé, pas Mapbox ni les transitions de la vraie
sheet. Le texte doublé est une approximation web, pas Dynamic Type natif.
Recette iOS/Android restant à faire : pan/zoom puis recherche, filtres conservés,
réseau lent et réessai, grande police système, VoiceOver/TalkBack (hint et busy),
safe areas, ouverture de la recherche et superposition sheet/fiche.

À la demande de l'utilisateur : même branche que SCRUM-288/289, commit distinct,
PR #52 en brouillon. Aucun déploiement ni clôture des signalements.
