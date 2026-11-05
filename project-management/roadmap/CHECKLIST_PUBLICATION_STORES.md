# Checklist publication stores

Les cases à cocher se tiennent dans le canevas `publication-stores-checklist`. Ce fichier est la copie écrite.

Coche une ligne en remplaçant `[ ]` par `[x]` quand c’est fait.
On ne crée pas de nouvelle base et on ne supprime pas la base d’ingestion avant l’étape 30.

Décisions du 4 novembre 2026 :

- La messagerie reste. On ajoute bloquer et signaler.
- Un prix inconnu s’affiche « Tarif non renseigné ».
- Les alertes « un moment près de toi » partent dans cette version.
- Les pubs sont allumées avant la publication.

Bases concernées : app `prymkgkafaovhzopslea`, ingestion `ieehuzeotwagkkprohjr`.

## Maintenant

- [x] **Toi.** Sauvegardes quotidiennes de la base app actives. Vu le 4 novembre 2026 : dernière sauvegarde du jour, 04:17 UTC. Ne pas cliquer sur Restore. Ne pas utiliser « Restore to new project ».
- [x] **Moi.** Tests au vert. TypeScript passe. 435 tests de filtres, 18 sur les cœurs, 2 sur les secrets. La CI lance aussi le lint et les tests. Modifications locales, pas encore commitées.

## Correctifs, un par un

- [x] **Moi.** La suppression de compte n’efface que les fichiers de la personne. Publié le 4 novembre 2026. [SCRUM-363](https://moments-locaux.atlassian.net/browse/SCRUM-363)
- [x] **Toi.** Autoriser l’essai sur deux comptes jetables, puis je l’exécute. Fait le 4 novembre 2026 : la photo de l’autre compte est restée. Les deux comptes jetables ont été retirés. Il reste 13 comptes.
- [x] **Moi.** Resserrer l’envoi des photos. Appliqué le 4 novembre 2026. [SCRUM-364](https://moments-locaux.atlassian.net/browse/SCRUM-364)
- [x] **Toi.** Valider cette modification de base avant qu’elle soit appliquée. Validé le 4 novembre 2026.
- [x] **Moi.** Fermer l’accès au classement. Appliqué le 4 novembre 2026. [SCRUM-365](https://moments-locaux.atlassian.net/browse/SCRUM-365)
- [x] **Moi.** Retirer le tirage au sort de secours de la connexion. Le téléphone utilise son générateur, sinon la connexion s’arrête. [SCRUM-366](https://moments-locaux.atlassian.net/browse/SCRUM-366)
- [x] **Moi.** Réparer l’export des données du compte. Publié le 4 novembre 2026. [SCRUM-367](https://moments-locaux.atlassian.net/browse/SCRUM-367)
- [ ] **Toi.** Vérifier l’archive d’un compte qui a commenté.
- [x] **Moi.** Rendre obligatoire la limite de deux couvertures générées. Compteur en place et fonction publiée le 4 novembre 2026. [SCRUM-368](https://moments-locaux.atlassian.net/browse/SCRUM-368)
- [x] **Toi.** Valider la limite de couvertures avant qu’elle soit appliquée. Validé le 4 novembre 2026.
- [x] **Moi.** Afficher « Tarif non renseigné » quand le prix n’est pas connu. [SCRUM-372](https://moments-locaux.atlassian.net/browse/SCRUM-372)
- [x] **Moi.** Afficher les messages récents, même après 80 messages. [SCRUM-370](https://moments-locaux.atlassian.net/browse/SCRUM-370)
- [x] **Moi.** Ajouter bloquer et signaler dans la messagerie. La base l’accepte depuis le 4 novembre 2026. L’écran arrive avec le prochain build. [SCRUM-369](https://moments-locaux.atlassian.net/browse/SCRUM-369)
- [x] **Moi.** Aligner l’app iPhone et Android sur la version store : pubs présentes dans le profil production, localisation permanente déjà déclarée. Le build store passe les notifications iPhone en production. Les vrais identifiants AdMob restent de ton côté. [SCRUM-373](https://moments-locaux.atlassian.net/browse/SCRUM-373)
- [ ] **Toi.** Installer ce build signé et confirmer les notifications et les pubs.
- [x] **Moi.** Appliquer l’acceptation des CGU sur la base app si elle n’y est pas déjà. Déjà en place le 4 novembre 2026. [SCRUM-256](https://moments-locaux.atlassian.net/browse/SCRUM-256)

## Nom « prod »

- [x] **Toi.** Renommer le projet app en `moments-locaux-prd`. La référence reste `prymkgkafaovhzopslea`. [SCRUM-159](https://moments-locaux.atlassian.net/browse/SCRUM-159)
- [x] **Toi.** Renommer le projet d’ingestion en `moments-locaux-ingest-prd`. La référence reste `ieehuzeotwagkkprohjr`. Ne pas le supprimer. [SCRUM-169](https://moments-locaux.atlassian.net/browse/SCRUM-169)
- [x] **Toi.** Renommer les coffres de mots de passe. Les clés ne changent pas.
- [x] **Toi.** Me dire quand les deux noms sont changés.
- [x] **Moi.** Renommer le libellé `dev` en `prd` dans le scraper et la console, sans changer les adresses. `dev` reste un alias le temps du passage. [SCRUM-164](https://moments-locaux.atlassian.net/browse/SCRUM-164) [SCRUM-163](https://moments-locaux.atlassian.net/browse/SCRUM-163)
- [ ] **Moi.** Vérifier que le site, la console, le scraper et l’app parlent encore aux deux mêmes bases. Fichiers locaux, VPS du scraper et console en ligne : base app `prymkgkafaovhzopslea`, ingestion `ieehuzeotwagkkprohjr` pour le scraper. Le site a ses domaines. Sa variable serveur ne s’affiche pas depuis ici. [SCRUM-168](https://moments-locaux.atlassian.net/browse/SCRUM-168)

## Nettoyage

- [x] **Moi.** Montrer combien d’événements terminés partiraient, sans rien supprimer. [SCRUM-376](https://moments-locaux.atlassian.net/browse/SCRUM-376)
- [x] **Toi.** Choisir combien de temps on garde un événement fini. Pour le lancement : fini avant aujourd’hui. Après la publication : archivage pour revoir ce à quoi on a participé.
- [x] **Toi.** Autoriser la suppression, uniquement sur les deux projets actuels. Fait le 4 novembre 2026 : finis avant le 4 novembre, phrase du site passée à « récoltés depuis le démarrage ».
- [x] **Toi.** Lister les comptes de test à enlever avant les captures. 13 comptes gardés, 96 supprimés le 4 novembre 2026, avec leurs photos et l’événement Viking.
- [x] **Moi.** Appliquer la purge après cet accord. 42 109 événements, 64 277 lignes de staging, 48 372 occurrences, 4 465 candidats de fusion.

## Adresses publiques

- [ ] **Toi.** Le nom `moments-locaux.com` est déjà sur le site. Il reste à confirmer que la variable serveur pointe sur la base app. [SCRUM-161](https://moments-locaux.atlassian.net/browse/SCRUM-161)
- [x] **Toi.** La page confidentialité s’ouvre sans mot de passe. Vérifié le 4 novembre 2026 : `https://www.moments-locaux.com/fr/privacy` répond.
- [ ] **Toi.** La console parle déjà à la base app, à l’adresse `admin.dev.moments-locaux.com`. Le nom sans « dev » n’existe pas encore. [SCRUM-163](https://moments-locaux.atlassian.net/browse/SCRUM-163)
- [ ] **Toi.** Le scraper parle déjà aux deux bases, à l’adresse `scrapper.dev.moments-locaux.com`. Le nom sans « dev » n’existe pas encore. [SCRUM-167](https://moments-locaux.atlassian.net/browse/SCRUM-167)
- [ ] **Toi.** Poser le domaine de connexion `auth.moments-locaux.com`, pour que l’iPhone n’affiche plus Supabase. Ce nom n’existe pas encore. [SCRUM-362](https://moments-locaux.atlassian.net/browse/SCRUM-362)
- [ ] **Moi.** Vérifier que ces adresses écrivent toujours au bon endroit. [SCRUM-246](https://moments-locaux.atlassian.net/browse/SCRUM-246)

## Pubs, alertes, stores

- [x] **Toi.** Les sept variables de production sont dans Expo : base, clé publique, carte, deux identifiants d’app AdMob, deux blocs natifs. 4 novembre 2026. [SCRUM-350](https://moments-locaux.atlassian.net/browse/SCRUM-350)
- [ ] **Toi.** Mettre les secrets de l’app et la clé de notifications Android dans EAS. [SCRUM-249](https://moments-locaux.atlassian.net/browse/SCRUM-249)
- [x] **Moi.** Builds production terminés le 4 novembre 2026. iPhone build 8 : https://expo.dev/accounts/roystok/projects/moments-locaux/builds/c644f69c-406b-4f85-8569-bec9c99f749f — Android version 3 : https://expo.dev/accounts/roystok/projects/moments-locaux/builds/2807aa50-375d-4275-854a-d35ee691e73e [SCRUM-248](https://moments-locaux.atlassian.net/browse/SCRUM-248)
- [ ] **Toi.** L’installer sur ton iPhone et ton Android.
- [x] **Moi.** Les alertes « près de toi » sont dans cette version, avec le texte des fiches. [SCRUM-323](https://moments-locaux.atlassian.net/browse/SCRUM-323)
- [x] **Moi.** Adapter les textes des fiches : pubs, localisation, 16 ans. Voir `docs/legal/STORE_PRIVACY_QUESTIONNAIRES.md`. [SCRUM-206](https://moments-locaux.atlassian.net/browse/SCRUM-206)
- [ ] **Toi.** Coller ces textes dans l’App Store. [SCRUM-250](https://moments-locaux.atlassian.net/browse/SCRUM-250)
- [ ] **Toi.** Coller ces textes dans le Play Store. [SCRUM-251](https://moments-locaux.atlassian.net/browse/SCRUM-251)
- [ ] **Moi.** Préparer des données propres pour les captures. [SCRUM-253](https://moments-locaux.atlassian.net/browse/SCRUM-253)
- [ ] **Toi.** Prendre les photos aux tailles demandées.
- [ ] **Toi.** Tester l’app de bout en bout sur les deux téléphones. [SCRUM-252](https://moments-locaux.atlassian.net/browse/SCRUM-252)
- [ ] **Moi.** Corriger ce qui bloque cette recette.
- [ ] **Toi.** Envoyer l’app à Apple. [SCRUM-254](https://moments-locaux.atlassian.net/browse/SCRUM-254)
- [ ] **Toi.** Côté Google, lancer le test des 12 personnes pendant 14 jours si le compte l’exige. [SCRUM-255](https://moments-locaux.atlassian.net/browse/SCRUM-255)

## Après l’acceptation des stores

- [ ] **Toi.** Me donner les deux liens des fiches.
- [ ] **Moi.** Mettre le QR et le lien selon le téléphone. [SCRUM-374](https://moments-locaux.atlassian.net/browse/SCRUM-374)
- [ ] **Toi.** Lancer la campagne.
- [ ] **Moi.** Si tu poses un pixel, ajouter le bandeau de consentement avant la première dépense. [SCRUM-375](https://moments-locaux.atlassian.net/browse/SCRUM-375)

## Tout à la fin

- [ ] **Toi et moi.** Créer un environnement de développement et un de recette, copiés depuis cette prod propre. Reporté le 4 novembre 2026 : on y revient plus tard. [SCRUM-160](https://moments-locaux.atlassian.net/browse/SCRUM-160) [SCRUM-162](https://moments-locaux.atlassian.net/browse/SCRUM-162) [SCRUM-166](https://moments-locaux.atlassian.net/browse/SCRUM-166)
