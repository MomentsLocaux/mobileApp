# MVP Action Plan

## Vision Globale

Le plan d'action vise à transformer Moments Locaux en MVP mobile publiable en réduisant d'abord le scope réel, puis en sécurisant les données et le lifecycle événement, puis en fiabilisant l'expérience et la release.

La règle directrice : aucune nouvelle feature majeure avant stabilisation des flux MVP.

## Lots D'Implémentation

### Lot 1 - P0 Structurels

Objectif : supprimer les blockers MVP public.

- Navigation/scope mobile.
- Auth/onboarding bloquant.
- Lifecycle événement.
- Supabase RLS/RPC critiques.
- GDPR/store minimum.
- Env/secrets/build blockers.
- Suppression compte.
- Légal minimum.

Tickets liés :

- `MVP-P0-001` à `MVP-P0-012`

### Lot 2 - P1 Fiabilité

Objectif : rendre la bêta sérieuse et store review crédibles.

- Médias/Storage.
- Search/map/location.
- Error handling/logs.
- Permissions.
- QA matrix.
- Build/release config.
- Design visible.
- Staging/seed demo.

Tickets liés :

- `MVP-P1-001` à `MVP-P1-010`

### Lot 3 - P2 Amélioration

Objectif : améliorer sans bloquer le MVP.

- Analytics minimal.
- Accessibilité approfondie.
- Offline partiel.
- Performance fine.
- Notifications backend/push.
- Anti-spam quotas avancés.
- Design secondary polish.

Tickets liés :

- `MVP-P2-001` à `MVP-P2-008`

### Lot 4 - Post-MVP

Objectif : expliciter ce qui sort du MVP mobile.

- Web admin app complète.
- Boutique.
- Missions.
- Offres.
- Wallet/Lumo avancé.
- Gamification avancée.
- Creator analytics avancés.
- Automatisations avancées.

Tickets liés :

- `MVP-POST-001` à `MVP-POST-006`

## Dépendances Entre Lots

- Lot 1 doit précéder toute bêta publique.
- Les tickets RLS/lifecycle doivent précéder les tests QA publics.
- GDPR/store doit précéder toute soumission App Store / Google Play.
- Build/release doit précéder QA finale.
- Data cleaning/seed doit précéder screenshots store et démo externe.
- Analytics/push/offline avancés doivent attendre que privacy, RLS et release soient stabilisés.

## Stratégie De Branches Git Recommandée

- `chore/audit-consolidation`
- `fix/p0-navigation-scope`
- `fix/p0-auth-onboarding`
- `fix/p0-event-lifecycle`
- `fix/p0-env-config`
- `fix/p0-gdpr-minimum`
- `fix/p0-supabase-rls`
- `fix/p0-database-integrity`
- `fix/p1-media-storage`
- `fix/p1-map-search`
- `fix/p1-error-handling`
- `fix/p1-build-release`

Règle : 1 ticket ou petit groupe cohérent = 1 branche = 1 PR = 1 review.

## Règles De Review

- Aucun écran non-MVP ne doit devenir visible par accident.
- Toute correction UI doit être vérifiée iOS + Android si elle touche navigation, auth, création ou carte.
- Toute correction Supabase doit être validée par tests de permissions anon/authenticated/owner/non-owner.
- Toute correction GDPR/store doit être relue côté produit/légal.
- Toute route masquée doit aussi être guardée.
- Aucun secret service role ne doit être exposé en config Expo.
- Les migrations destructives doivent être séparées, relues et jamais exécutées sans validation.

## Commandes De Vérification Globales

```bash
npm run typecheck
npm run lint
npx expo config
git diff --stat
```

Pour Supabase, uniquement scripts de diagnostic non destructifs avant validation explicite.

## Ordre D'Exécution Recommandé

1. `chore/audit-consolidation`
2. `fix/p0-navigation-scope`
3. `fix/p0-supabase-rls`
4. `fix/p0-event-lifecycle`
5. `fix/p0-gdpr-minimum`
6. `fix/p0-auth-onboarding`
7. `fix/p0-env-config`
8. `fix/p1-build-release`
9. `fix/p1-media-storage`
10. `fix/p1-map-search`
11. `fix/p1-error-handling`
12. `fix/p1-qa-matrix`
