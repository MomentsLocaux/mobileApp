# UI-CATEGORIES-001 — catégories, contours et durée

Demande utilisateur du 2 octobre 2026. Branche : `fix/category-visuals-and-duration`.
Référence locale, aucun ticket Jira créé dans cette intervention.

## Changements

- Complément agenda : accès aux filtres dans l’en-tête, compteur des familles actives et `MapFiltersSheet` en contexte agenda. Catégories/sous-catégories/durée dans un brouillon local ; le calendrier conserve la maîtrise des dates. `filterAgendaContentEvents` applique les mêmes contraintes aux listes, compteurs, repères, plage aimée et carte, sans exclure les événements passés ni modifier les favoris. Un résultat vide invite à modifier les filtres. Les filtres de découverte ne sont pas modifiés.
- Complément utilisateur sur la même branche (UI-CATEGORIES-001) : `AgendaScreen` affiche « On prépare ton agenda… » pendant le chargement, en cohérence avec le tutoiement du sous-titre.
- `MapDiscoveryEventCard` (feed, row, spotlight), `EventCard` et `HomeEventVisual` : contour de catégorie au-dessus de la couverture, sans interception des appuis. Le contour normal mesure 1,5 px ; la sélection feed reste renforcée.
- `category-visuals.ts` : pictogrammes vectoriels simplifiés correspondant aux dix silhouettes de la carte. Masques, panier à anse, ourson et cloche de service dessinés sur la grille Lucide ; note, pousse, livre, haltère, maison et étoiles partagent cette famille. Les PNG des marqueurs cartographiques ne changent pas.
- Consommateurs couverts par le registre : création/suggestion (`CategorySelector`), onboarding/préférences (`OnboardingThemesStep`), badges de notifications, placeholders. Conversion des anciens usages PNG hors carte (`HomeCategoryGlyph`, badge de carte) et de l’emoji de repli des propositions. Le placeholder résout aussi les UUID de catégorie.
- `CategoryFilterSelector` : présentation identique dans `SearchBar` et `MapFiltersSheet`, couleurs de catégorie, texte lisible, cibles de 44 px, libellés pouvant revenir à la ligne. La désélection d’une catégorie retire ses sous-catégories du brouillon.
- `EventDurationSelector` partagé : « Sur combien de jours ? », choix multiples 1–3 / 4–14 / 15+ jours. Il s’agit de la durée totale de l’événement, pas du temps passé sur place. Absence de sélection = toutes les durées. « Quoi » modifie le brouillon existant et son résumé ; application, annulation et réinitialisation suivent le circuit existant.
- Inventaire `docs/CHARTER_UI_SURFACES.md` mis à jour. Aucun changement serveur, migration ou configuration de build.

## Vérifications

- `npm run typecheck` : succès.
- `npm run lint` : 0 erreur, 42 avertissements préexistants.
- `npm run test:filters` : 389 tests réussis, dont deux nouveaux tests sur le filtrage de l’agenda : intersection catégorie/sous-catégorie/durée, conservation des événements passés, absence de mutation, cohérence calendrier/plage/liste.
- `node audits/ui-categories/build.cjs`, puis `node audits/ui-categories/verify.cjs` : revue isolée React Native Web avec Chrome. Sélection individuelle, tout sélectionner/désélectionner, durées multiples et retour à aucune sélection ; cibles des catégories ≥ 44 px ; absence de débordement horizontal à 320/390/430 px ; approximation de texte à 200 % ; les appuis sur les trois variantes de carte atteignent leur action d’ouverture.
- Captures `selectors-*.png` : composants réels, police de l’app. Les dépendances natives/backend sont remplacées uniquement dans cette fixture ; la couverture est une surface opaque simulée pour vérifier le contour. Aucun réseau externe ou donnée personnelle.
- `git diff --check` : succès.
- `node audits/ui-categories/build.cjs --agenda`, puis `node audits/ui-categories/verify-agenda.cjs` : modale réelle avec mouvement/safe area simulés, ouverture/fermeture, abandon du brouillon, enregistrement, retrait des sous-catégories devenues incompatibles, réinitialisation annulée puis enregistrée ; captures à 320/390 px ; section des dates toujours présente en contexte carte.

## Limites de validation

Pas de validation sur appareil iOS/Android ni de parcours complet connecté. Les annonces VoiceOver/TalkBack, Dynamic Type natif et l’application/annulation de la recherche complète restent à contrôler sur appareil. La transaction de la modale agenda est vérifiée dans la fixture. Les boutons cœur sont remplacés dans la fixture ; leur comportement applicatif n’est pas modifié. Aucun nouveau ticket nécessaire identifié.

Des modifications concurrentes de `src/types/database.ts` et de fichiers Supabase sont apparues dans le workspace pendant cette intervention. Elles ne font pas partie de ce travail ; aucune migration n’a été exécutée par cette intervention.
