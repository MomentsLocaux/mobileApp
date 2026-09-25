# HOME-CONTEXT-001 — accueil contextualisé

25 septembre 2026 · branche existante `feat/home-redesign-contextual`.

Demande : faire évoluer le travail local et la feuille de route fournie, en conservant les nouveaux glyphes. Le workspace comporte déjà la première implémentation non commitée ; la demande explicite de poursuivre cette branche prime sur la création depuis main évoquée dans la feuille de route. Aucun changement de branche ou merge.

## Audit avant développement

La séparation écran / useHomeFeed / composants / ranking est déjà présente. Restent à fiabiliser : périodes Home/carte divergentes, sélection territoriale hors période, comptages non exhaustifs présentés comme totaux, rechargements liés au nombre de résultats, réponses tardives lors des changements de zone, restauration du cache après hydratation, doubles appuis cœur, prochaine sortie et signal social périmés après changement de compte. Le header utilise encore d'anciens pictogrammes. L'accès invité au Home est bloqué dans les onglets.

Réutiliser : EventCoverImage, EventHeartButton, BrandIcon, silhouettes PNG des catégories, cache de découverte, services Agenda/Stats/Préférences, discoveryFiltersStore et mapTransferStore. Faire évoluer les composants Home existants ; ajouter uniquement un visuel partagé de couverture/catégorie et la logique isolée nécessaire.

Architecture : services/cache → useHomeFeed (cycle de vie, contexte, mutations) → fonctions pures (périodes, ranking, éditorial, territoire, social) → composants Home → filtres partagés + transfert Carte / route Agenda.

Données : API existantes, aucun SQL/migration. Charger un pool local plafonné, les préférences en parallèle, un petit lot social et les événements nécessaires à l'agenda. Les nombres issus d'un échantillon/cache ne doivent pas annoncer un total exhaustif. « Ce soir » doit utiliser le même intervalle sur Home et Carte.

Risques : horaires incomplets, pool plafonné, réponse réseau périmée, changement de compte, localisation refusée, gestes natifs. Réduction des animations, couleurs et glyphes existants à préserver.

## Critères

- Trois recommandations maximum, ranking stable/diversifié et motifs factuels.
- Aucun scroll infini, hero court, un seul sélecteur temporel.
- Prochain moment futur et un seul signal social facultatifs, sans doublon inutile.
- Carte ouverte avec la même période et zone, recherche exclusivement sur Carte.
- Cache immédiatement utilisable ; erreurs/rechargements locaux ; pas de requête à chaque like/changement de segment.
- Invités : découverte libre, connexion proposée seulement pour les actions protégées.
- Vérifications : typecheck, lint, tests métier, fixtures visuelles multi-tailles ; aucune promesse de performance native sans mesure.

## Livraison

Implémentation et vérifications : [rapport détaillé](../../audits/home-contextual/README.md). Captures multi-tailles et scénarios dans `audits/home-contextual/`. Recette native iOS/Android à compléter ; performance release au ticket MVP-P2-004. Aucun merge.
