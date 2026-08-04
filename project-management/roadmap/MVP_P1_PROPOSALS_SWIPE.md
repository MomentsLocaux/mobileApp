# MVP-P1-PROPOSALS-SWIPE — Note d'implémentation

## Périmètre

Nouvel onglet B2C **Propositions**, indépendant du Discovery Engine. Cette livraison ne modifie ni
`FEATURE_DISCOVERY`, ni `DISCOVERY_ENABLED`, ni les routes, stores ou services du moteur Discovery.

## Parcours et décisions UX

- Wizard en 3 étapes : catégories, point d'ancrage/rayon, période.
- Préférences conservées localement ; deck actif conservé en mémoire lors d'un aller-retour vers le détail.
- Pool de 20 événements maximum.
- Swipe à droite : like persisté via le service de likes existant.
- Swipe à gauche : pass limité à la session et non persisté côté Supabase.
- Boutons accessibles avec la même sémantique que les gestes.
- Like et favori restent deux actions distinctes. Le favori est proposé dans le récapitulatif.
- Fin de deck : « Encore 20 », « Modifier mes envies », « Voir mes favoris ».
- Aucun délai long artificiel : transition visuelle minimale de 550 ms, absorbée par le temps réel de requête.

## Données et requêtes

- Une récupération par pool via `listMapViewportForMap`, donc le RPC existant `list_map_viewport` avec RLS.
- Bornes rectangulaires calculées depuis le point d'ancrage, puis contrôle exact du rayon côté client.
- Défense en profondeur côté client : uniquement `published` + `public`, plage de dates, catégories et rayon.
- Exclusion des événements déjà likés, déjà présentés et passés pendant la session.
- Tri déterministe par distance puis date ; pas de scoring ML.
- Aucune migration, aucun accès service role, aucune nouvelle table.

## Checklist manuelle

- [ ] Un compte B2C voit cinq entrées en mode découverte : Accueil, Propositions, Carte, Favoris, panneau profil.
- [ ] Un compte professionnel ne voit pas l'onglet Propositions.
- [ ] Premier accès : les trois étapes du wizard sont navigables et les préférences sont préremplies au retour.
- [ ] GPS refusé : la recherche d'une ville permet de terminer le wizard.
- [ ] Pool : les cartes respectent catégories, rayon et période.
- [ ] Swipe droite ou bouton cœur : le like est visible ailleurs dans l'application.
- [ ] Swipe gauche ou bouton pouce : la carte n'est plus reproposée dans la session.
- [ ] Tap carte : le détail s'ouvre et le retour reprend au même index.
- [ ] Récap : ajouter/retirer un favori ne modifie pas le like.
- [ ] « Encore 20 » exclut les cartes déjà parcourues.
- [ ] Aucun résultat et erreur réseau affichent des actions de récupération.
- [ ] Vérifier le rendu et la fluidité sur iOS et Android réels.

## Limites assumées

- Les passes disparaissent au redémarrage de l'application.
- Aucun événement analytics n'est émis : il n'existe pas d'infrastructure analytics générique hors Discovery.
- Pas de dates personnalisées dans cette première itération Propositions.

