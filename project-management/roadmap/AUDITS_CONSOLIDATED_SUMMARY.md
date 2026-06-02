# Audits Consolidated Summary

## Résumé Exécutif

Les audits convergent vers un même diagnostic : Moments Locaux peut devenir un MVP mobile publiable sans ajouter de grandes fonctionnalités, mais il faut réduire la surface mobile, sécuriser Supabase, stabiliser le lifecycle événement, finaliser le minimum GDPR/store et fiabiliser médias/build/QA.

Le risque le plus transversal est le décalage entre ce qui est caché dans l'UI et ce qui reste accessible par route, deep link, RLS, RPC ou Storage. Le MVP doit donc être traité en profondeur : navigation, routes, backend, données, légalité et release.

## Audits Trouvés

26 fichiers d'audit/synthèse ont été trouvés dans `audits/`, plus `MVP_SCOPE.md`.

### Wave 1 - Publishable MVP

- `01_MVP_SCOPE_NAVIGATION_AUDIT.md` - scope mobile, drawer, tabs, routes non-MVP.
- `02_AUTH_ONBOARDING_AUDIT.md` - auth, session, onboarding, guest, biométrie.
- `03_EVENT_LIFECYCLE_AUDIT.md` - statuts événement, édition, soumission, refus.
- `04_SUPABASE_RLS_AUDIT.md` - RLS, tables sensibles, RPC, Storage.
- `05_DATABASE_INTEGRITY_AUDIT.md` - FK, statuts, profils/auth, données test.
- `06_GDPR_STORE_COMPLIANCE_AUDIT.md` - privacy, store, suppression compte, UGC.
- `WAVE_1_EXECUTIVE_SUMMARY.md` - synthèse publiable MVP.

### Wave 2 - Reliable MVP

- `01_MEDIA_STORAGE_AUDIT.md` - médias, buckets, upload, orphelins.
- `02_SEARCH_MAP_LOCATION_AUDIT.md` - Mapbox, recherche, bbox, localisation.
- `03_PERFORMANCE_MOBILE_AUDIT.md` - perf carte, images, subscriptions, stores.
- `04_ERROR_HANDLING_OBSERVABILITY_AUDIT.md` - erreurs, logs, crash reporting.
- `05_QA_MATRIX_AUDIT.md` - matrice QA manuelle MVP.
- `06_BUILD_RELEASE_AUDIT.md` - config Expo, release, env, versioning.
- `WAVE_2_EXECUTIVE_SUMMARY.md` - synthèse reliable MVP.

### Wave 3 - Scalable MVP

- `01_DATA_CLEANING_MVP_SEED_AUDIT.md` - nettoyage data, staging, seed MVP.
- `02_NOTIFICATIONS_AUDIT.md` - inbox, unread, realtime, push, routing.
- `03_ABUSE_ANTI_SPAM_TRUST_SAFETY_AUDIT.md` - spam, bans, quotas, reports.
- `04_ACCESSIBILITY_AUDIT.md` - labels, touch targets, lecteur d'écran.
- `05_LEGAL_APP_CONTENT_AUDIT.md` - CGU, privacy, règles communautaires.
- `06_PRODUCT_ANALYTICS_AUDIT.md` - tracking minimal, privacy.
- `07_OFFLINE_WEAK_NETWORK_AUDIT.md` - réseau faible, brouillons, upload.
- `WAVE_3_EXECUTIVE_SUMMARY.md` - synthèse scalable MVP.

### Standalone Audits

- `DESIGN_AUDIT.md` - cohérence UX/UI.
- `RLS_AUDIT.md` - audit live Supabase/RLS.
- `DATA_CLEANING_AUDIT.md` - volumes live, storage, scripts proposés.
- `GDPR_MVP_AUDIT.md` - inventaire privacy/store détaillé.

## Fichiers Sources Utilisés

Les audits citent notamment :

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/map.tsx`
- `app/(tabs)/shop.tsx`
- `app/(tabs)/missions.tsx`
- `app/moderation/*`
- `app/events/create/*`
- `src/screens/events/EventDetailScreen.tsx`
- `src/screens/profile/MyEventsScreen.tsx`
- `src/screens/auth/*`
- `src/screens/onboarding/OnboardingScreen.tsx`
- `src/screens/notifications/NotificationsInboxScreen.tsx`
- `src/data-provider/supabase-provider.ts`
- `src/services/notifications.service.ts`
- `src/services/checkin.service.ts`
- `src/hooks/useLocation.ts`
- `src/hooks/useImagePicker.ts`
- `src/hooks/useCreateEventStore.ts`
- `app.config.ts`
- `app.json`
- `package.json`
- `supabase/migrations/*`
- Supabase live checks from previous audits.

## Principaux Risques Transverses

- Admin/modération encore accessible côté mobile.
- Routes non-MVP deep-linkables.
- RLS trop permissive sur données sensibles.
- RPC pouvant contourner les filtres `published/public`.
- Lifecycle événement dépendant du client.
- Suppression compte affichée mais non fonctionnelle.
- CGU/privacy/mentions incomplètes.
- Médias et Storage publics sans gouvernance suffisante.
- Logs/erreurs techniques exposés en production.
- Build/release non reproductible.
- Données dev/test visibles en staging/store.

## Conflits Identifiés

- `MVP_SCOPE.md` liste encore la modération admin comme visible MVP, en conflit avec ADR 001.
- Les notifications peuvent router vers `/moderation/reports`, en conflit avec admin web-only.
- Certains textes CGU mentionnent achats intégrés, monnaie virtuelle, boosts, alors que ces features sont post-MVP.
- Certains audits proposent push/analytics/offline avancés ; ces sujets doivent rester P2/Post-MVP sauf minimum privacy/fiabilité.
- Les écrans admin mobile existants ne doivent pas être considérés comme "déjà faits" pour le MVP.

## Décisions Produit À Confirmer

- Nom final et identifiants : `Moments Locaux`, `com.momentslocs.app` ou variante.
- Biométrie : conserver avec full logout ou masquer.
- Commentaires : visibles dans MVP ou limités.
- Push notifications : masqué jusqu'à implémentation réelle ou assumé post-MVP.
- Événements privés : garder MVP ou reporter.
- Lumo/check-in XP : masquer gamification visible ou garder une récompense simple.

## Synthèse Par Priorité

### P0 - Bloquant MVP Public

- Retirer admin/modération mobile.
- Guarder routes non-MVP.
- Corriger RLS critiques et RPC events.
- Verrouiller lifecycle événement.
- Finaliser suppression compte.
- Finaliser CGU/privacy/mentions/contact.
- Ajouter consentement register.
- Réparer auth/onboarding profil absent.
- Sécuriser env/secrets/build blockers.
- Garantir aucun event non public sur carte/liste/detail public.

### P1 - Avant Bêta Sérieuse / Store Review

- Stabiliser médias/Storage.
- Rationaliser permissions.
- Nettoyer logs production.
- Améliorer error handling.
- Fiabiliser map/search/location.
- Créer QA matrix exécutable.
- Ajouter EAS/build numbers.
- Harmoniser design visible.
- Nettoyer staging/seed demo.

### P2 - Post-MVP Proche

- Analytics minimal.
- Accessibilité approfondie.
- Offline partiel.
- Notifications backend/push.
- Anti-spam quotas avancés.
- Performance fine.
- Cache/thumbnails.

### Post-MVP

- Web app admin complète.
- Boutique.
- Missions.
- Offres.
- Wallet/Lumo avancé.
- Gamification avancée.
- Creator analytics avancés.
- Automatisations avancées.

## Ordre Recommandé De Traitement

1. ADR et scope mobile.
2. P0 navigation/routes.
3. P0 Supabase RLS/RPC/lifecycle.
4. P0 GDPR/store minimum.
5. P0 auth/onboarding.
6. P0 build/env/secrets.
7. P1 médias, erreurs, map/search.
8. P1 QA/release.
9. P2 analytics/accessibility/offline.
10. Post-MVP features.
