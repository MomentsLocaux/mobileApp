# SCRUM-293 — Retrait par glissement dans les favoris

Le glissement vers la gauche révèle « Retirer » dans les lignes aimées/favorites
de l'Agenda (onglet, entrée modale et liste de la plage mensuelle). Le glissement
seul n'écrit rien. L'appui appelle explicitement `removeEventHeart`, même si le
cache local a changé depuis l'ouverture. Le cœur actif appelle déjà ce retrait
via `toggleEventHeart` : même verrou, suppression idempotente et réconciliation
issus de SCRUM-288. Le catalogue n'est jamais supprimé.

`AgendaSwipeAction` encapsule le geste ; les cartes partagées hors Agenda ne
changent pas. Une seule ligne peut rester ouverte, grâce au coordinateur partagé
par les deux listes. Jour, onglet, tiroir, liste/carte, calendrier, plage, ouverture
de la modale, refresh ou perte de focus referment la ligne. Un changement de
largeur ou d'échelle de police réinitialise aussi les mesures du composant.

Le retrait reste pessimiste et utilise le verrou immédiat déjà présent dans
l'écran : spinner et bouton désactivé pendant l'opération. Après succès, les
stores, compteurs, listes et aperçu carte suivent le même chemin que le cœur.
Après erreur, réconciliation et rechargement existants tentent de retrouver
l'état serveur ; si le réseau reste indisponible, la ligne connue est conservée,
avec alerte et nouvelle tentative. Si le serveur confirme un retrait effectif
malgré une réponse réseau perdue, la ligne peut légitimement disparaître.

## Geste, accessibilité et charte

- Activation horizontale à 20 px ; échec du recognizer au-delà de 12 px verticaux
  avant activation. Aucun auto-retrait en fin de geste ou dépassement de largeur.
- Cible de retrait ≥ 44 px, largeur adaptée à la taille de texte, tokens erreur
  clairs et icône cœur Duo végétal. Pas de nouvelle dépendance ni token global.
- L'action masquée est absente de l'arbre accessible. Le cœur de la carte reste
  l'action équivalente sans glissement. Le bouton révélé annonce titre, retrait,
  désactivation et chargement.
- Relecture de la checklist charte et de la règle Cursor, des cartes partagées,
  du cœur et de la sheet mensuelle ; ligne Agenda mise à jour dans la checklist.
- Utilise le `Swipeable` fourni par RNGH 2.28 installé. Ce composant historique
  transmet bien `failOffsetY` au recognizer ; dans cette version,
  `ReanimatedSwipeable` ne transmet pas cette option à son Pan. Une migration
  future devra préserver l'arbitrage vertical. Aucune mise à jour de bibliothèque.

## Vérification — 30 septembre 2026

- `npm run typecheck` : réussi.
- `npm run lint` : 0 erreur, 42 avertissements préexistants.
- `npm run test:hearts` : 18 tests réussis, dont deux régressions pour le retrait
  explicite avec cache inactif et les appuis concurrents bouton/cœur.
- `npm run test:filters` : 378 tests réussis.
- `npm run check:secrets` et `git diff --check` : réussis.
- Fixture React Native Web avec **vrai wrapper, coordinateur et recognizer RNGH**,
  contenu de carte et réponse de retrait simulés. Gestes tactiles via Chrome :
  scroll vertical, révélation sans retrait/navigation, une seule ligne ouverte,
  fermeture de contexte, bouton complètement découvert à 320/390 px, état en
  cours, appui répété bloqué, échec puis nouvelle tentative, alternative cœur.
  Captures `swipe-*.png` inspectées. Un contrôle de hit-testing protège le cas de
  redimensionnement qui pouvait laisser la ligne recouvrir une partie du bouton.

```sh
npm install --prefix /private/tmp/scrum-290-tools --no-package-lock --no-audit --no-fund esbuild playwright-core
node audits/scrum-293/build.cjs
node audits/scrum-293/verify.cjs
```

La fixture ne valide pas les cartes réelles, le réseau distant, la navigation
native ou l'arbitrage des gestes de la bottom sheet mensuelle. Recette iOS/Android
restante : VoiceOver/TalkBack, grande police système, scroll/fiche/calendrier,
dernier favori et état vide, persistance après refresh, réseau lent/hors ligne.

Branche partagée avec SCRUM-288/289/290 sur demande explicite de l'utilisateur ;
commit distinct et PR #52 en brouillon. Aucun déploiement ni signalement clôturé.
