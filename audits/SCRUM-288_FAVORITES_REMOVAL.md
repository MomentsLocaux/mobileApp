# SCRUM-288 — Retrait fiable des favoris

Date : 2026-09-30. Ticket : https://moments-locaux.atlassian.net/browse/SCRUM-288

Branche : `fix/scrum-288-favorites-removal`, depuis `origin/main` (`2ecb2c8`).

## Constat et correction

L'Agenda rangeait l'union des likes et favoris dans le store des favoris. Pour un événement uniquement liké sur le serveur, le retrait appelait alors deux bascules : le like disparaissait, mais un favori était créé.

- Le chargement conserve séparément favoris réels, likes et union affichée.
- Un cœur actif déclenche deux suppressions explicites, filtrées par compte initiateur et événement. Répéter le retrait ne recrée aucune relation.
- Les mutations partagent un verrou par compte/événement et synchronisent les stores avec des setters idempotents.
- Les deux écritures doivent être terminées avant la réconciliation d'un échec partiel. Si la relecture échoue aussi, l'état local connu est conservé et une nouvelle tentative reste possible.
- Une réponse de mutation d'un ancien compte ne modifie pas les stores du compte actif.
- Les consommateurs Accueil, Carte, Agenda, liste, fiche et Propositions utilisent la synchronisation commune. L'Agenda recharge après erreur et ferme l'aperçu d'un favori retiré.
- Un chargement Agenda antérieur à une mutation ne peut pas restaurer son ancien résultat. Les compteurs de l'Agenda et de la carte tiennent compte d'une suppression partielle réconciliée.

## Fichiers applicatifs

- `src/utils/event-heart.ts` : mutation, verrou, synchronisation, réconciliation.
- `src/services/social.service.ts` : lecture de l'état réel et suppressions bornées au compte/événement.
- `src/services/agenda.service.ts` : distinction des appartenances.
- `src/store/favoritesStore.ts`, `src/store/likesStore.ts` : setters et hydratation.
- `src/screens/agenda/AgendaScreen.tsx` : chargement, retrait, aperçu, compteurs et erreurs.
- `src/hooks/map/useMapSocialActions.ts`, `app/(tabs)/map.tsx` : intégration carte et double clic.
- `src/hooks/useHomeFeed.ts` : intégration accueil et rechargement après erreur.
- `src/screens/events/EventDetailScreen.tsx`, `src/screens/events/EventsListScreen.tsx` : intégration et erreurs.
- `src/screens/proposals/ProposalsScreen.tsx` : appels de mutation partagés.
- `scripts/event-heart.test.mjs`, `package.json` : tests de régression exécutant les modules TS réels avec réseau et stockage natif simulés ; inclus dans `npm test`.

## Vérifications

- `npm run typecheck` : OK.
- `npm run lint` : 0 erreur, 42 avertissements préexistants (même total avant/après).
- `npm run test:hearts` : 16 tests OK, dont les trois combinaisons de relations, retrait répété, double clic, deux types d'échec partiel, écriture lente, hors ligne, changement de compte et filtres de propriété.
- `npm run test:filters` : 378 tests OK.
- `npm run test:secrets` : 2 tests OK.
- `git diff --check` : OK.

Pas de modification de schéma, migration, exécution de suppression sur la base distante ou nouvelle surface hors Alpha.

## Limites et recette avant fusion

Les tests automatisés simulent les services distants ; ils ne remplacent pas la recette native iOS/Android ni une vérification RLS avec comptes de test. Ces validations n'ont pas été exécutées dans cette mission.

Recette : depuis Agenda, retirer un like seul, un favori seul, puis les deux ; vérifier après refresh et sur Carte/Accueil/fiche. Tester l'aperçu carte sélectionné, le double clic, le réseau défaillant et une nouvelle tentative. L'ajout reste fondé sur les RPC de bascule existantes ; ce ticket corrige le retrait.

La limite existante de 500 relations par requête Agenda et les limites de cache persistant restent inchangées. Le store en mémoire ne tronque plus les favoris chargés à 200, pour ne pas effacer leur état visible.

## Travaux locaux préexistants sauvegardés séparément

- `chore/pre-scrum-288-ios-release` — `e394931` : configuration iOS et liaison ExpoImage. `typecheck`, `lint` et `npx expo config --json` réussis avant sauvegarde ; manifeste privacy identique après parsing. Le lancement Xcode en Release est conservé tel quel. Aucun build natif effectué.
- `docs/pre-scrum-288-alpha-email` — `ddc8ac4` : modèle d'invitation Alpha et deux assets, conservés comme brouillon. Aucun email envoyé ; les liens de builds et le rendu dans les clients email restent à valider avant diffusion.

Ces branches sont poussées sur origin et ne sont pas incluses dans le diff SCRUM-288. Leur sauvegarde ne vaut pas fusion ou validation de diffusion.
