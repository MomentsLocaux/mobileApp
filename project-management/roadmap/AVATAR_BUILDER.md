# AVATAR-001 — Créateur d’avatar cartoon

Branche : `feat/avatar-builder`.

Demande produit explicite du 2026-09-18 : développer l’éditeur dans une nouvelle branche, en extension du choix d’avatar de l’onboarding et du profil. Cette autorisation porte sur cette fonctionnalité ; le reste du périmètre Alpha reste inchangé.

## Critères d’acceptation

- Partir du portrait sélectionné, de l’avatar personnalisé enregistré ou d’un modèle par défaut si une photo est sélectionnée.
- Modifier indépendamment visage, yeux, bouche, nez, oreilles, coiffure, pilosité, accessoire et couleurs, avec aperçu immédiat.
- Conserver les 20 modèles et le choix d’une photo ; proposer une composition aléatoire et un retour au portrait initial.
- Appliquer seulement à la validation ; fermer ou annuler ne modifie pas la sélection parente.
- Enregistrer avec le parcours profil/onboarding existant et retrouver la configuration lors de la réouverture.
- Afficher le résultat via `UserAvatar` partout où les portraits sont déjà pris en charge.
- Rejeter sans crash les configurations invalides, trop longues ou de version inconnue ; conserver les formats `preset:` et photo.
- Respecter la charte claire, les safe areas, les petites fenêtres et les libellés d’accessibilité.

## Stockage et compatibilité

Configuration locale versionnée encodée dans `avatar_url` : `avatar:v1:<JSON encodé URI>`. Aucun upload pour les illustrations, aucune nouvelle table, aucune migration. Les clés et variantes v1 doivent rester compatibles avec les données enregistrées. Toute rupture de format ou de rendu nécessite une nouvelle version et le maintien du lecteur v1.

Les anciens clients qui ne connaissent pas `avatar:v1:` afficheront leur fallback. La visibilité sur des clients web externes utilisant directement une balise image nécessitera l’adoption du même rendu.

## Vérification

Tests automatisés de sérialisation, validation, compatibilité et randomisation ; `npm run typecheck` ; `npm run lint` ; contrôle visuel du rendu et de l’éditeur. Validation native finale : ouvrir depuis onboarding/profil, modifier chaque catégorie, annuler, appliquer, enregistrer le profil, rouvrir et consulter un profil pair.

## Résultat — 2026-09-19

Implémenté sur la branche dédiée, disponible depuis le sélecteur partagé de l’onboarding et du profil.

- 4 formes de visage, 5 styles d’yeux, 4 bouches, 3 nez, 3 tailles d’oreilles, 13 coiffures, 4 pilosités, 7 accessoires et 6 palettes (teint, cheveux, iris, vêtement, accessoire, fond).
- Validation explicite du brouillon, annulation, modèle de départ, composition aléatoire, retour à la configuration initiale.
- `npm run typecheck` : OK.
- `npm run lint` : 0 erreur, 41 avertissements hors fichiers de cette fonctionnalité.
- `npx tsc -p tsconfig.filters-test.json` puis `node --test /tmp/moments-locaux-filter-tests/utils/avatar-config.test.js /tmp/moments-locaux-filter-tests/utils/avatar-presets.test.js` : 13 tests réussis.
- Test interactif Chrome/React Native Web avec les vrais composants et polices, via une page de test locale : annulation, toutes les catégories/couleurs, application, rechargement avec stockage local, réouverture, aléatoire/réinitialisation, modèles, bascule photo/modèle, footer accessible à 320 × 568. Aucune erreur JavaScript pendant le parcours final.
- `git diff --check` : OK.

Captures : [visage 390 px](../../audits/avatar-builder/editor-390.png), [coiffures 390 px](../../audits/avatar-builder/editor-hair-390.png), [format compact 320 px](../../audits/avatar-builder/editor-320.png).

Le test navigateur valide la conservation de la configuration dans une page de test utilisant le stockage local. L’enregistrement réseau via un compte connecté et les rendus natifs iOS/Android restent à vérifier manuellement. Aucune écriture distante ni modification Supabase n’a été effectuée. Les outils de vérification web ont été installés uniquement dans `/tmp` ; aucune dépendance applicative ajoutée.

## Fichiers du ticket

- `src/components/onboarding/AvatarEditorModal.tsx` : éditeur et brouillon local.
- `src/components/onboarding/AvatarPresetPicker.tsx` : entrée création/modification et coexistence modèles/photos.
- `src/components/ui/PresetAvatarArt.tsx`, `UserAvatar.tsx` : variantes vectorielles et résolution du format personnalisé ; une photo en erreur ne bloque plus les autres URL sélectionnées.
- `src/constants/avatar-options.ts`, `avatar-presets.ts`, `src/utils/avatar-config.ts` : catalogue, types, conversion et sérialisation validée.
- `src/screens/onboarding/OnboardingScreen.tsx`, `src/screens/profile/ProfileEditScreen.tsx` : textes du parcours.
- `src/utils/avatar-config.test.ts`, `tsconfig.filters-test.json` : tests de compatibilité et validation.
- `docs/CHARTER_UI_SURFACES.md`, `project-management/roadmap/MVP_TICKETS.md`, ce ticket et `audits/avatar-builder/*.png` : périmètre et preuves de revue.
