# 01 - MVP Scope & Navigation Audit

## Résumé exécutif

L'application est déjà recentrée sur un socle MVP visible : auth, onboarding, carte, recherche, création d'événement, profil, favoris, communauté, notifications, paramètres, signalements et bug report. Le nettoyage produit réalisé précédemment a retiré une partie importante de l'effet prototype.

Le point bloquant principal est que des routes non-MVP restent enregistrées et donc potentiellement accessibles par deep link ou navigation directe. Le plus sensible est la modération admin encore présente dans l'application mobile, alors que la décision produit actuelle prévoit une web app admin séparée.

Niveau de préparation : moyen. L'interface principale est proche du scope MVP, mais la surface de navigation réelle reste trop large pour une version store.

## Constats

### Navigation principale

- `app/(tabs)/_layout.tsx` expose les tabs visibles `map`, `create`, `community`, `profile`.
- `shop`, `favorites` et `missions` sont déclarées avec `href: null`.
- `favorites` reste accessible depuis le drawer, ce qui est cohérent avec le MVP.
- `shop` et `missions` ne sont plus visibles, mais restent accessibles par route directe.

### Drawer profil

- Le drawer conserve les entrées MVP utiles : créer un événement, profil, communauté, paramètres, notifications, favoris, mes événements, bug report, logout.
- Le lien `Modération` reste visible si `profile.role === moderateur/admin`.
- Le footer contient une version hardcodée `Version 2.4.0`.
- Le fallback utilisateur `email@exemple.com` donne encore une impression de prototype si un profil incomplet arrive jusque-là.

### Root stack

`app/_layout.tsx` enregistre encore :

- `moderation/index`
- `moderation/events`
- `moderation/comments`
- `moderation/users`
- `moderation/reports`
- `moderation/media`
- `moderation/contests`

Ces routes sont incompatibles avec la décision produit : la modération admin ne doit pas être gérée dans le mobile MVP.

### Routes non-MVP encore présentes

Routes ou modules à garder hors UI et idéalement à bloquer côté route :

- `app/(tabs)/shop.tsx`
- `app/(tabs)/missions.tsx`
- `app/profile/offers.tsx`
- `app/profile/journey.tsx`
- `app/creator/index.tsx` si les statistiques créateur ne sont pas fiables
- `app/events/create/step-3.tsx`, qui semble être un ancien flux de création non utilisé par le chemin actuel `step-2 -> preview`
- routes settings avancées masquées mais présentes : `email`, `preferences`, `sessions`, `password`, `export`

### Deep links et query params

- Les routes masquées ne sont pas supprimées ni gardées par feature flag.
- Les routes de création supportent `?edit=eventId`.
- Le scope MVP dépend encore trop du fait que l'utilisateur ne voie pas certains liens, alors que les routes restent atteignables.

## Risques

- Store review ou bêta test découvrant des écrans non finalisés.
- Accès mobile à de la modération admin malgré la décision produit.
- Confusion produit entre app locale simple et app gamifiée/marketplace.
- Routes deep link pouvant exposer des flows non testés.
- Impression prototype via fallback email/version hardcodée.

## Recommandations

- Retirer la modération admin du drawer mobile.
- Retirer les routes `moderation/*` du root stack mobile, ou les rediriger vers un écran neutre non exposé en production.
- Ajouter un mécanisme de feature flag ou de route guard pour les modules non-MVP : boutique, missions, offres, journey, creator dashboard, step-3 legacy.
- Remplacer la version hardcodée par une valeur issue de config, ou la masquer.
- Ajouter une règle simple : une feature non-MVP ne doit pas seulement être cachée dans un menu, elle doit aussi être protégée au niveau route.

## Quick wins

- Masquer définitivement le lien `Modération` dans le drawer mobile.
- Retirer les `Stack.Screen` de modération dans `app/_layout.tsx`.
- Rediriger `shop`, `missions`, `profile/offers`, `profile/journey` vers `/settings` ou `/profile` en production MVP.
- Supprimer ou neutraliser `app/events/create/step-3.tsx` du parcours public.
- Remplacer `email@exemple.com` par un libellé neutre du type `Profil incomplet`.

## Points bloquants MVP

- P0 : modération admin encore visible/accessible dans l'application mobile.
- P0 : routes non-MVP deep-linkables sans garde centralisée.
- P1 : ancienne route de création `step-3` encore présente.
- P1 : version/fallback hardcodés.

## Priorisation

### P0

- Supprimer l'accès mobile à la modération admin.
- Protéger ou rediriger les routes non-MVP.
- Vérifier tous les deep links Expo Router liés à shop, missions, offres, creator dashboard et moderation.

### P1

- Nettoyer les fallbacks visibles.
- Ajouter une convention de feature flag MVP.
- Documenter la liste des routes autorisées en production.

### P2

- Réintroduire progressivement les modules post-MVP via flags.
- Préparer une vraie stratégie deep link publique.

## Fichiers concernés

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/shop.tsx`
- `app/(tabs)/missions.tsx`
- `app/profile/offers.tsx`
- `app/profile/journey.tsx`
- `app/creator/index.tsx`
- `app/events/create/step-3.tsx`
- `app/moderation/*`
