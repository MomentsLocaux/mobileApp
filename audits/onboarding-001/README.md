# ONBOARDING-001 — revue du parcours découverte

Direction validée le 7 octobre 2026 : carnet de découvertes, charte menthe/encre/anis,
Plus Jakarta Sans et illustrations Duo végétal. Branche `fix/onboarding-001-premium`.

## Changements

- `OnboardingScreen.tsx` : entête/progression et actions fixes ; corps défilant remis en haut
  au changement d’étape ; clavier fermé lors de la navigation ; champ lieu avec action Modifier ;
  portrait agrandi, présentation compacte sous 700 px ; correction du passage de la dernière étape.
- `OnboardingWelcomeStep.tsx` et `OnboardingNeighborhood.tsx` : accueil illustré, trois repères,
  signature Lumia et fond végétal atténué sur le parcours.
- `OnboardingPermissionsStep.tsx` : résumé dynamique du pack, détails sous Ajuster, pictogrammes
  Duo végétal. Même pack, mêmes demandes système et même explication de la proximité arrière-plan.
- `OnboardingThemesStep.tsx` : liste compacte, libellés encre, sélection colorée et cochée,
  état de sélection accessible sur mobile et web.
- Roadmap et checklist de charte mises à jour. Aucun composant partagé, flag, service ou fichier
  Supabase modifié. L’animation existante respecte déjà la réduction des mouvements.

## Vérifications

- `npm run lint` : 0 erreur, 41 avertissements hors fichiers applicatifs modifiés.
- `npm run typecheck` : échec sur deux erreurs existantes, également observées avant la refonte
  du cadre : `src/lib/webcrypto.ts:126` (`ArrayBufferLike` / `ArrayBuffer`) et
  `src/services/community.service.ts:347` (`person` implicitement `any`). Aucun diagnostic onboarding.
- `git diff --check` : OK.
- `node audits/onboarding-001/build.cjs` puis `node audits/onboarding-001/verify.cjs` :
  rendu des vrais composants React Native Web, avec services et données simulés, sans appels externes.
  Six étapes, formats 390 × 844 et 320 × 568 ; CTA fixe, nom requis, recherche sans résultat,
  sélection/modification du lieu, alertes ajustables, retour conservant les choix, thèmes facultatifs,
  sauvegarde et navigation sans portrait, fermeture du parcours rejoué.

La fixture utilise esbuild et playwright-core depuis `/private/tmp/scrum-290-tools/node_modules`,
Chrome local et les dépendances de l’application. Les captures sont regroupées dans `index.html`.
Les permissions affichent l’état web « Indisponible sur cet appareil » : ces captures ne valident
pas les dialogues iOS/Android. Les services sont simulés ; aucune écriture distante n’est réalisée.

## Validation native restante

Clavier iOS/Android (petit écran, saisie g/p/y), grandes tailles de texte système,
VoiceOver/TalkBack, demandes de permissions acceptées/refusées, photo/caméra et sauvegarde réelle.
Ces vérifications constituent la suite QA du ticket ; les deux erreurs TypeScript doivent être
traitées dans leurs périmètres respectifs avant une validation globale du projet.
