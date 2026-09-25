# HOME-CONTEXT-001 — accueil contextualisé

Implémentation du 25 septembre 2026, branche `feat/home-redesign-contextual`. Poursuite du brouillon existant conformément à la demande ; aucun changement de branche ni merge.

## Comportement livré

L’accueil garde un seul bloc de découverte, trois cartes au maximum et un accès permanent à la carte. Le prochain moment enregistré et le signal social s’affichent uniquement quand des données réelles les justifient. Ils ne répètent pas les événements déjà mis en avant dans les autres blocs. Recherche = ouverture du panneau Carte ; Agenda = ouverture à la date du prochain moment. Les invités peuvent ouvrir Accueil, les événements et la carte ; un compte est demandé pour enregistrer ou accéder à l’espace personnel.

Le header, les actions et les illustrations de catégories utilisent les glyphes actuels. Les couvertures conservent leur contour de catégorie ; une silhouette locale assure le repli si l’image manque ou échoue. Le cœur partagé conserve la modification « blanc sur photo » réalisée en parallèle dans le workspace.

Le menu normal contient Accueil / Carte / Agenda / Profil. Les propositions restent accessibles depuis le tiroir. Les règles existantes des comptes professionnels et les feature flags Lumia / social / check-in sont conservés.

## Règles de sélection

- Éligibilité : événement publié, public, daté, non terminé, dans le rayon demandé.
- Maintenant = réellement en cours. Ce soir = chevauchement de la fenêtre locale 17 h–23 h 59. Demain et Week-end reprennent les fenêtres existantes de la carte.
- À l’entrée, le créneau dépend du jour et de l’heure ; s’il est vide, sélectionner un créneau disponible. Après un choix manuel, respecter ce choix. Un snapshot peut fournir cette sélection avant le réseau.
- Classement : proximité jusqu’à 40 points, imminence jusqu’à 25, préférences explicites jusqu’à 20, popularité plafonnée à 15, fraîcheur jusqu’à 10. Diversité : −18 par catégorie déjà choisie, −80 pour un titre répété. IDs dédoublonnés et trois cartes maximum, quel que soit le nombre demandé.
- Motifs affichés : en cours, démarrage dans moins de 90 minutes, un thème préféré ou moins de 2 km. Pas de justification IA inventée.
- Prochain moment : première date future enregistrée dans les 30 prochains jours.
- Territoire : ville comprenant au moins deux événements dans la période choisie. Nombre d’événements et proximité déterminent la ville ; la carte reçoit le centre calculé, un rayon couvrant les événements et la même période.
- Social : un signal dans les sept jours, lié à des suivis réels. « Enregistré » ne signifie pas participation ; le nom d’une personne ayant liké n’est pas attribué à un enregistrement dont l’auteur est inconnu.

## Données et fiabilité

Le hook orchestre les services existants, les préférences explicites, l’agenda, le cache de découverte et un lot social de neuf IDs au maximum. Le pool local est plafonné à 120 événements. Les segments sont calculés localement ; changer de segment ou aimer un événement ne relance pas la requête de zone. Les préchargements portent sur les trois cartes et le prochain moment.

Les nombres provenant d’un pool plafonné ou du cache ne sont pas présentés comme des totaux : CTA générique et « au moins » pour la ville. Un créneau sans candidat dans un pool incomplet n’affirme pas qu’aucun événement n’existe.

Les réponses périmées sont ignorées avant l’écriture du cache. Le rafraîchissement conserve les cartes connues. L’agenda et le social sont rattachés au compte courant ; le cœur utilise l’appartenance à cet agenda, puis les helpers existants d’ajout garanti/retrait explicite. Les doubles appuis sont bloqués et les erreurs restent visibles. Aucun changement de schéma, migration, configuration native ou nouvelle dépendance applicative.

## Fichiers

Créés pendant cette intervention :

- `src/components/home/HomeEventVisual.tsx`.
- `project-management/roadmap/HOME_CONTEXTUAL.md`.
- Ce dossier : README, galerie, fixture réelle, builder, vérificateur, résultat JSON et captures.

Brouillon existant adapté (plusieurs fichiers étaient déjà non versionnés) :

- `src/screens/home/HomeScreen.tsx`, `src/hooks/useHomeFeed.ts`.
- `src/components/home/HomeHeader.tsx`, `ContextualHero.tsx`, `NextMomentCard.tsx`, `HomeTimeSelector.tsx`, `HomeEventCard.tsx`, `NearbyMomentsSection.tsx`, `LocalPulseCard.tsx`, `SocialSignalCard.tsx`.
- `src/utils/home-feed.ts`, `src/utils/home-feed.test.ts`.

Intégration partagée modifiée :

- `app/(tabs)/_layout.tsx` : accueil public, quatre onglets standards, propositions dans le tiroir.
- `src/constants/brand-icon-artwork.ts` : loupe Duo végétal ; `src/components/ui/EmptyState.tsx` : accepte ce système d’icônes.
- `src/constants/filters.ts`, `src/types/filters.ts`, `src/store/searchStore.ts` : preset `tonight`.
- `src/utils/event-date-windows.ts`, `filter-events.ts`, `search-filters.ts`, `search-temporal-choice.ts`, `src/hooks/map/useMapFilterActions.ts` : période du soir partagée.
- `docs/CHARTER_UI_SURFACES.md` : surfaces Home vérifiées.

Les changements préexistants de `map.tsx`, `AgendaScreen.tsx`, `mapTransferStore.ts`, `SearchBar.tsx`, `SearchResultsBottomSheet.tsx` et la déclaration de tests dans `tsconfig.filters-test.json` ont été conservés. Les changements concurrents des composants cœur/partage/cartes n’ont pas été réécrits ni attribués à ce ticket.

## Vérifications

- `npm run typecheck` : OK.
- `npm run lint` : aucune erreur ; 41 avertissements dans le workspace, aucun dans les fichiers Home de cette intervention.
- `npm run test:filters` : 373 tests passent, dont les scénarios Home (périodes, diversité, dédoublonnage, préférences, ville, social, comptages et agenda).
- `node audits/home-contextual/build-review.cjs` puis `node audits/home-contextual/verify.cjs` : vérification React Native Web de l’écran, du hook et des stores réels. Services simulés, données fictives, barre d’onglets statique pour cadrage ; pas de connexion aux comptes de production.
- 320 / 390 / 430 px, réduction des animations activée : pas de débordement horizontal de page, contenu inférieur à deux hauteurs utiles dans ces fixtures ; cartes au maximum trois. Tests de transfert carte/période, date Agenda, lancement recherche, double appui, erreur d’enregistrement, invité, cache avant réseau, rafraîchissement hors ligne, réponse de zone obsolète, vide, GPS absent, couverture valide et invalide. Résultats : `verification.json`.
- `git diff --check` : OK.

Ouvrir `index.html` pour la galerie. Les captures représentent les composants réels avec des données fictives ; ce ne sont pas des captures d’un téléphone.

## Limites et suites

1. Recette iOS / Android sur appareil : gestes, vraie navigation Mapbox, VoiceOver/TalkBack, taille dynamique et réseau réel. La fixture vérifie le transfert de filtres, pas le rendu natif de Mapbox ni son mouvement de caméra.
2. Le pool plafonné est une sélection et peut manquer des événements dans une zone dense. Les horaires récurrents continuent d’utiliser le contrat temporel commun existant ; leur précision dépend des données et du moteur d’horaires partagé.
3. Les gains de démarrage et de mémoire ne sont pas mesurés en release. Le moteur d’images, les miniatures réseau et la coordination du splash restent au ticket **MVP-P2-004**, déjà audité. L’agenda utilise ses API actuelles (jusqu’à 500 IDs par source) ; une récupération serveur ciblée du prochain moment serait une évolution distincte si nécessaire.
4. Aucun nouveau bloc IA, nouvelle API ni chantier Supabase requis pour livrer ce Home. Aucun merge effectué.
