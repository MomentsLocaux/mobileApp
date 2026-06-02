# MVP Tickets

## P0 - Bloquants Avant MVP Public

### ID: MVP-P0-001

Titre: Retirer les surfaces admin/modération du mobile

Priorité: P0

Source audit: `01_MVP_SCOPE_NAVIGATION_AUDIT.md`, `06_GDPR_STORE_COMPLIANCE_AUDIT.md`, `02_NOTIFICATIONS_AUDIT.md`, `ADR_001`

Responsable / agent recommandé: Product Owner MVP, UX/UI Guardian

Type d'action: Navigation / scope

Fichiers probablement concernés: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/moderation/*`, `src/screens/notifications/NotificationsInboxScreen.tsx`, `app/(tabs)/profile.tsx`

Description: Retirer ou guarder toutes les entrées mobile menant à la modération admin, y compris drawer, profil, root stack, notifications et deep links.

Critères d'acceptation: Aucun utilisateur mobile ne voit ni n'ouvre un écran admin ; `/moderation/*` redirige ou est absent en production ; notifications ne routent plus vers `/moderation/reports`.

Commandes de vérification: `npm run typecheck`, `npm run lint`, revue navigation iOS/Android.

Risques: Casser un lien interne existant ; laisser une route deep-linkable.

Dépendances: `ADR_001_ADMIN_MODERATION_WEB_APP.md`

Branche Git recommandée: `fix/p0-navigation-scope`

Notes: Priorité la plus haute car elle conditionne le scope MVP.

### ID: MVP-P0-002

Titre: Guarder routes non-MVP et écrans placeholder

Priorité: P0

Source audit: `01_MVP_SCOPE_NAVIGATION_AUDIT.md`, `DESIGN_AUDIT.md`, `ADR_002`

Responsable / agent recommandé: UX/UI Guardian

Type d'action: Navigation / route guards

Fichiers probablement concernés: `app/(tabs)/shop.tsx`, `app/(tabs)/missions.tsx`, `app/profile/offers.tsx`, `app/profile/journey.tsx`, `app/creator/*`, `app/events/create/step-3.tsx`

Description: Empêcher l'accès public mobile aux routes boutique, missions, offres, wallet/Lumo, creator analytics, journey et legacy create step.

Critères d'acceptation: Les routes non-MVP ne sont pas visibles ; les deep links redirigent vers un écran MVP sûr ; aucun placeholder visible.

Commandes de vérification: `npm run typecheck`, `npm run lint`, tests deep links manuels.

Risques: Retirer une route encore utilisée indirectement.

Dépendances: ADR 002.

Branche Git recommandée: `fix/p0-navigation-scope`

Notes: À grouper avec P0-001 si PR reste petite.

### ID: MVP-P0-003

Titre: Sécuriser RLS des tables sensibles

Priorité: P0

Source audit: `04_SUPABASE_RLS_AUDIT.md`, `RLS_AUDIT.md`, `06_GDPR_STORE_COMPLIANCE_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Supabase RLS

Fichiers probablement concernés: `supabase/migrations/*`, `src/data-provider/supabase-provider.ts`

Description: Corriger les policies sur `event_checkins`, `bug_reports`, `event_views`, `event_likes`, `reports`, `notifications`, `favorites`, `follows` selon ownership et visibilité.

Critères d'acceptation: Anon ne lit plus check-ins/bug reports/event views user-level ; authenticated non-owner ne lit pas données privées ; owner lit uniquement ses données ; reports lisibles admin/service only.

Commandes de vérification: scripts SQL non destructifs de permissions anon/auth/owner/non-owner.

Risques: Casser des flows mobile si policies trop strictes.

Dépendances: Données de test Supabase.

Branche Git recommandée: `fix/p0-supabase-rls`

Notes: Ne pas exécuter migration destructive sans validation.

### ID: MVP-P0-004

Titre: Sécuriser RPC events et accès aux événements non publics

Priorité: P0

Source audit: `03_EVENT_LIFECYCLE_AUDIT.md`, `04_SUPABASE_RLS_AUDIT.md`, `02_SEARCH_MAP_LOCATION_AUDIT.md`, `RLS_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect

Type d'action: RPC / RLS / data access

Fichiers probablement concernés: `supabase/migrations/*`, `src/data-provider/supabase-provider.ts`, `app/(tabs)/map.tsx`

Description: Garantir que `get_events_by_ids`, detail access et map/list ne retournent jamais `draft`, `pending`, `refused`, `archived` ou `private` à un non-owner non autorisé.

Critères d'acceptation: Tests anon/auth non-owner confirment uniquement `published/public`; owner peut voir ses propres statuts dans `MyEvents`; private audience respecte les règles décidées.

Commandes de vérification: SQL non destructif + test carte/list/detail.

Risques: Favoris ou deep links vers events privés cassés si règles mal définies.

Dépendances: P0-003.

Branche Git recommandée: `fix/p0-supabase-rls`

Notes: P0 car fuite de contenu non publié.

### ID: MVP-P0-005

Titre: Verrouiller le lifecycle événement côté serveur et mobile

Priorité: P0

Source audit: `03_EVENT_LIFECYCLE_AUDIT.md`, `05_DATABASE_INTEGRITY_AUDIT.md`, `RLS_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect, Mobile Reliability Engineer

Type d'action: Business rules / lifecycle

Fichiers probablement concernés: `app/events/create/*`, `src/screens/events/EventDetailScreen.tsx`, `src/screens/profile/MyEventsScreen.tsx`, `supabase/migrations/*`

Description: Autoriser seulement les transitions MVP : create draft, draft/refused -> pending, published read-only côté mobile, archived non public.

Critères d'acceptation: Un owner ne peut pas éditer un published depuis détail/deep link ; un refused peut être corrigé et resoumis ; pending n'est pas modifiable sauf règle validée ; contraintes serveur empêchent escalade status.

Commandes de vérification: `npm run typecheck`, `npm run lint`, tests lifecycle manuels + permissions SQL.

Risques: Bloquer édition légitime si statut mal géré.

Dépendances: P0-004.

Branche Git recommandée: `fix/p0-event-lifecycle`

Notes: Critique pour crédibilité modération.

### ID: MVP-P0-006

Titre: Rendre suppression compte fonctionnelle et conforme

Priorité: P0

Source audit: `06_GDPR_STORE_COMPLIANCE_AUDIT.md`, `GDPR_MVP_AUDIT.md`, `05_DATABASE_INTEGRITY_AUDIT.md`

Responsable / agent recommandé: GDPR / Store Compliance Officer, Supabase Security Architect

Type d'action: GDPR / backend / UX

Fichiers probablement concernés: `app/settings/privacy/delete.tsx`, `src/services/auth.service.ts`, Supabase Edge Function/RPC, Storage policies

Description: Remplacer l'écran déclaratif par un flow réel de suppression/anonymisation compte, contenus privés, médias et Auth user selon stratégie validée.

Critères d'acceptation: L'utilisateur peut supprimer/demander suppression depuis l'app ; données privées supprimées ; contenus publics anonymisés selon règle ; médias traités ; action testée en staging.

Commandes de vérification: tests manuels staging + diagnostic DB/Storage non destructif.

Risques: Suppression accidentelle ou rupture FK.

Dépendances: stratégie privacy/data.

Branche Git recommandée: `fix/p0-gdpr-minimum`

Notes: Store blocker.

### ID: MVP-P0-007

Titre: Finaliser CGU, privacy, mentions et consentement inscription

Priorité: P0

Source audit: `06_GDPR_STORE_COMPLIANCE_AUDIT.md`, `GDPR_MVP_AUDIT.md`, `05_LEGAL_APP_CONTENT_AUDIT.md`, `02_AUTH_ONBOARDING_AUDIT.md`

Responsable / agent recommandé: GDPR / Store Compliance Officer, Product Owner MVP

Type d'action: Legal content / auth UX

Fichiers probablement concernés: `app/settings/legal/*`, `app/settings/privacy/policy.tsx`, `src/screens/auth/RegisterScreen.tsx`, `src/screens/auth/LoginScreen.tsx`

Description: Finaliser contenus légaux, retirer placeholders, ajouter contact privacy/support et acceptation CGU/privacy au register.

Critères d'acceptation: Aucun placeholder `[a completer]`; CGU/privacy accessibles depuis register/settings; consentement explicite enregistré ou au minimum obligatoire côté UI.

Commandes de vérification: `npm run typecheck`, `npm run lint`, revue contenu.

Risques: Texte juridique non validé ; scope non-MVP mentionné dans CGU.

Dépendances: validation business/légale.

Branche Git recommandée: `fix/p0-gdpr-minimum`

Notes: Ne pas créer de texte juridique définitif sans validation humaine.

### ID: MVP-P0-008

Titre: Corriger auth/onboarding pour profil absent et logout biométrique

Priorité: P0

Source audit: `02_AUTH_ONBOARDING_AUDIT.md`, `06_GDPR_STORE_COMPLIANCE_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Auth / state management

Fichiers probablement concernés: `app/_layout.tsx`, `app/index.tsx`, `src/hooks/useAuth.ts`, `src/services/auth.service.ts`, `src/data-provider/auth-provider.ts`

Description: Centraliser init auth, gérer session sans profil, clarifier soft logout/biométrie ou masquer biométrie.

Critères d'acceptation: Session + profil absent répare profil et redirige onboarding ; logout ne restaure pas sans action ; full logout/oubli device disponible si biométrie gardée.

Commandes de vérification: `npm run typecheck`, `npm run lint`, tests auth/register/login/logout/onboarding.

Risques: Boucles de navigation auth.

Dépendances: décision biométrie.

Branche Git recommandée: `fix/p0-auth-onboarding`

Notes: À tester sur app restart.

### ID: MVP-P0-009

Titre: Sécuriser env, API locale et secrets

Priorité: P0

Source audit: `06_BUILD_RELEASE_AUDIT.md`, `MVP_SCOPE.md`, `GDPR_MVP_AUDIT.md`

Responsable / agent recommandé: Release Manager

Type d'action: Config / secrets

Fichiers probablement concernés: `.env`, `app.config.ts`, `src/data-provider/config.ts`, `src/data-provider/api-provider.ts`

Description: Vérifier qu'aucune API locale hardcodée ni service role key ne peut être embarquée dans l'app ; documenter env dev/staging/prod.

Critères d'acceptation: Pas de `192.168.*` ou localhost de prod ; service role non `EXPO_PUBLIC`; app démarre avec env dev/staging/prod ; API legacy désactivée si non utilisée.

Commandes de vérification: `rg \"192\\.168|localhost|SERVICE_ROLE|EXPO_PUBLIC_SERVICE\" .`, `npx expo config`.

Risques: Fuite secret.

Dépendances: aucune.

Branche Git recommandée: `fix/p0-env-config`

Notes: Ne jamais afficher les secrets en logs.

### ID: MVP-P0-010

Titre: Sécuriser Storage et empêcher fallback public dangereux

Priorité: P0

Source audit: `01_MEDIA_STORAGE_AUDIT.md`, `04_SUPABASE_RLS_AUDIT.md`, `RLS_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect, Mobile Reliability Engineer

Type d'action: Storage / media

Fichiers probablement concernés: `src/components/events/CoverImageUploader.tsx`, `src/data-provider/supabase-provider.ts`, `src/components/events/EventPhotoContributionModal.tsx`, Supabase Storage policies

Description: Supprimer fallback bucket `public` en production, vérifier ownership upload/read/delete et empêcher exposition contributions non validées.

Critères d'acceptation: Upload échoue proprement si bucket manquant ; user ne peut pas uploader dans dossier autre user ; contributions non approuvées non publiques par logique produit.

Commandes de vérification: tests upload owner/non-owner + `npm run typecheck`.

Risques: Casser upload si buckets mal nommés.

Dépendances: Storage policies.

Branche Git recommandée: `fix/p1-media-storage`

Notes: Classé P0 pour fuite média potentielle.

### ID: MVP-P0-011

Titre: Bloquer writes pour profils bannis/suspendus

Priorité: P0

Source audit: `03_ABUSE_ANTI_SPAM_TRUST_SAFETY_AUDIT.md`, `RLS_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Trust & safety / RLS

Fichiers probablement concernés: `supabase/migrations/*rls*`, `src/types/database.ts`

Description: Appliquer `is_profile_active` ou équivalent sur writes MVP : events, comments, reports, follows, media submissions, check-ins si pertinent.

Critères d'acceptation: Un profil `banned/suspended` ne peut plus publier, commenter, suivre, uploader ou spammer reports ; profil actif fonctionne.

Commandes de vérification: tests SQL non destructifs avec comptes de test.

Risques: Bloquer reports légitimes si statut restricted mal défini.

Dépendances: P0-003.

Branche Git recommandée: `fix/p0-supabase-rls`

Notes: Quotas avancés restent P2.

### ID: MVP-P0-012

Titre: Valider build MVP minimal et versioning

Priorité: P0

Source audit: `06_BUILD_RELEASE_AUDIT.md`, `WAVE_2_EXECUTIVE_SUMMARY.md`

Responsable / agent recommandé: Release Manager

Type d'action: Build / release

Fichiers probablement concernés: `app.config.ts`, `app.json`, `package.json`, future `eas.json`

Description: S'assurer que typecheck/lint/config passent, que build numbers sont prêts et que Mapbox/native config n'empêche pas une release candidate.

Critères d'acceptation: `npm run typecheck`, `npm run lint`, `npx expo config` OK ; build numbers définis ; aucun secret public ; stratégie EAS décidée.

Commandes de vérification: `npm run typecheck`, `npm run lint`, `npx expo config`.

Risques: Build native impossible tardivement.

Dépendances: P0-009.

Branche Git recommandée: `fix/p1-build-release`

Notes: Ne pas lancer build dans ce ticket sans demande explicite.

## P1 - Avant Bêta Sérieuse / Store Review

### ID: MVP-P1-001

Titre: Rationaliser permissions iOS/Android

Priorité: P1

Source audit: `06_GDPR_STORE_COMPLIANCE_AUDIT.md`, `06_BUILD_RELEASE_AUDIT.md`

Responsable / agent recommandé: GDPR / Store Compliance Officer, Release Manager

Type d'action: Store compliance

Fichiers probablement concernés: `app.config.ts`, `app.json`

Description: Vérifier permissions localisation, caméra, photos, notifications, biométrie et retirer/masquer celles non justifiées.

Critères d'acceptation: Chaque permission a un usage MVP et un texte clair ; push non prêt non promis.

Commandes de vérification: `npx expo config`, revue Play/App Store.

Risques: Retirer permission utilisée par upload/check-in.

Dépendances: décision push/biométrie.

Branche Git recommandée: `fix/p1-build-release`

Notes:

### ID: MVP-P1-002

Titre: Nettoyer logs production et standardiser error handling

Priorité: P1

Source audit: `04_ERROR_HANDLING_OBSERVABILITY_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Error handling / observability

Fichiers probablement concernés: `src/data-provider/supabase-provider.ts`, `src/services/mapbox.service.ts`, `src/hooks/*`, `app/(tabs)/map.tsx`, `src/components/events/*`

Description: Encadrer logs techniques, éviter détails sensibles en production, ajouter feedback utilisateur sur erreurs upload/carte/auth.

Critères d'acceptation: Pas de logs sensibles prod ; erreurs critiques affichent message utilisateur ; logs techniques gardés en dev.

Commandes de vérification: `rg \"console\\.\" app src`, `npm run lint`.

Risques: Masquer un signal utile en dev.

Dépendances: aucune.

Branche Git recommandée: `fix/p1-error-handling`

Notes:

### ID: MVP-P1-003

Titre: Stabiliser upload médias

Priorité: P1

Source audit: `01_MEDIA_STORAGE_AUDIT.md`, `03_PERFORMANCE_MOBILE_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Media reliability

Fichiers probablement concernés: `src/hooks/useImagePicker.ts`, `src/components/events/CoverImageUploader.tsx`, `src/screens/profile/ProfileEditScreen.tsx`

Description: Ajouter taille max, compression/redimensionnement, messages d'erreur et conventions chemins cohérentes.

Critères d'acceptation: Images lourdes refusées ou compressées ; upload avatar/cover/contribution fonctionne iOS/Android ; erreur réseau ne supprime pas inutilement le choix utilisateur.

Commandes de vérification: tests manuels médias + `npm run typecheck`.

Risques: Régression upload.

Dépendances: P0-010.

Branche Git recommandée: `fix/p1-media-storage`

Notes:

### ID: MVP-P1-004

Titre: Fiabiliser search/map/location

Priorité: P1

Source audit: `02_SEARCH_MAP_LOCATION_AUDIT.md`, `03_PERFORMANCE_MOBILE_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Map/search reliability

Fichiers probablement concernés: `app/(tabs)/map.tsx`, `src/components/search/SearchBar.tsx`, `src/services/mapbox.service.ts`, `src/hooks/useLocation.ts`

Description: Ajouter feedback Mapbox/réseau/localisation, stabiliser empty states et limiter refetchs inutiles.

Critères d'acceptation: Localisation refusée compréhensible ; recherche erreur vs aucun résultat distinguée ; carte stable lors de zoom/pan.

Commandes de vérification: tests carte iOS/Android.

Risques: Complexifier UX carte.

Dépendances: P0-004.

Branche Git recommandée: `fix/p1-map-search`

Notes:

### ID: MVP-P1-005

Titre: Exécuter QA Matrix MVP

Priorité: P1

Source audit: `05_QA_MATRIX_AUDIT.md`, `MVP_SCOPE.md`

Responsable / agent recommandé: QA Lead

Type d'action: QA / release

Fichiers probablement concernés: `project-management/roadmap/*`, app entière

Description: Transformer la matrice QA en checklist exécutable et la faire passer sur iOS/Android réels.

Critères d'acceptation: Chaque flux critique a statut Pass/Fail/Notes/Build ; P0 failing crée ticket dédié.

Commandes de vérification: QA manuelle.

Risques: Découvrir blockers tardivement.

Dépendances: release candidate.

Branche Git recommandée: `fix/p1-qa-matrix`

Notes:

### ID: MVP-P1-006

Titre: Structurer release EAS et versioning

Priorité: P1

Source audit: `06_BUILD_RELEASE_AUDIT.md`

Responsable / agent recommandé: Release Manager

Type d'action: Release management

Fichiers probablement concernés: `eas.json`, `app.config.ts`, `package.json`

Description: Ajouter stratégie dev/preview/prod, build numbers, scripts/checklist release.

Critères d'acceptation: profils EAS documentés ; version/build numbers explicites ; release checklist prête.

Commandes de vérification: `npx expo config`, sans lancer build sauf demande.

Risques: Config native sensible.

Dépendances: P0-012.

Branche Git recommandée: `fix/p1-build-release`

Notes:

### ID: MVP-P1-007

Titre: Harmoniser design visible MVP

Priorité: P1

Source audit: `DESIGN_AUDIT.md`

Responsable / agent recommandé: UX/UI Guardian

Type d'action: UX/UI

Fichiers probablement concernés: auth, onboarding, creation, event cards, settings, drawer

Description: Corriger incohérences visibles de couleurs, badges, empty/loading/error states et placeholders sans refonte.

Critères d'acceptation: Plus de texte prototype visible ; badges statuts cohérents ; auth/onboarding propre.

Commandes de vérification: screenshots iOS/Android.

Risques: Refonte trop large.

Dépendances: scope MVP.

Branche Git recommandée: `fix/p1-design-polish`

Notes:

### ID: MVP-P1-008

Titre: Nettoyer staging et seed demo MVP

Priorité: P1

Source audit: `DATA_CLEANING_AUDIT.md`, `01_DATA_CLEANING_MVP_SEED_AUDIT.md`, `05_DATABASE_INTEGRITY_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect, QA Lead

Type d'action: Data / staging

Fichiers probablement concernés: scripts SQL proposés séparés, Supabase staging

Description: Préparer diagnostic non destructif, nettoyer staging avec validation et seed demo propre.

Critères d'acceptation: Staging contient données MVP propres ; pas de données Picsum/test visibles ; auth.users non touché sans validation.

Commandes de vérification: SQL diagnostic lecture seule.

Risques: Suppression accidentelle.

Dépendances: environnement staging.

Branche Git recommandée: `fix/p0-database-integrity`

Notes:

### ID: MVP-P1-009

Titre: Clarifier notifications inbox vs push

Priorité: P1

Source audit: `02_NOTIFICATIONS_AUDIT.md`, `06_BUILD_RELEASE_AUDIT.md`

Responsable / agent recommandé: Product Owner MVP, Mobile Reliability Engineer

Type d'action: Notifications UX/backend

Fichiers probablement concernés: `app/settings/notifications.tsx`, `src/services/notifications.service.ts`, `src/screens/notifications/NotificationsInboxScreen.tsx`

Description: Assumer inbox MVP, masquer push si non prêt, gérer notifications orphelines et pagination de base.

Critères d'acceptation: Aucun wording push non implémenté ; notification vers ressource supprimée affiche message clair ; own-only validé.

Commandes de vérification: tests inbox.

Risques: Réduire une feature attendue.

Dépendances: P0-003, P0-001.

Branche Git recommandée: `fix/p1-notifications`

Notes:

### ID: MVP-P1-010

Titre: Afficher raison de refus événement

Priorité: P1

Source audit: `03_EVENT_LIFECYCLE_AUDIT.md`, `05_LEGAL_APP_CONTENT_AUDIT.md`

Responsable / agent recommandé: Product Owner MVP, Mobile Reliability Engineer

Type d'action: Event lifecycle UX

Fichiers probablement concernés: `src/screens/profile/MyEventsScreen.tsx`, `app/events/create/*`, database fields/migration if missing

Description: Afficher une raison de refus lisible dans `MyEvents` et guider la resoumission.

Critères d'acceptation: Event refused montre motif ; CTA corriger/resoumettre ; pending après resoumission.

Commandes de vérification: test lifecycle refused.

Risques: Champ raison absent en DB.

Dépendances: P0-005.

Branche Git recommandée: `fix/p0-event-lifecycle`

Notes:

## P2 - Améliorations Post-MVP Proches

### ID: MVP-P2-001

Titre: Définir analytics produit minimal

Priorité: P2

Source audit: `06_PRODUCT_ANALYTICS_AUDIT.md`

Responsable / agent recommandé: Product Owner MVP

Type d'action: Analytics / privacy

Fichiers probablement concernés: futur service tracking, privacy policy

Description: Définir tracking plan minimal sans données sensibles.

Critères d'acceptation: Liste events validée ; privacy mise à jour si tracking activé.

Commandes de vérification: revue produit/privacy.

Risques: Tracking excessif.

Dépendances: privacy P0.

Branche Git recommandée: `feat/p2-product-analytics`

Notes:

### ID: MVP-P2-002

Titre: Améliorer accessibilité

Priorité: P2

Source audit: `04_ACCESSIBILITY_AUDIT.md`

Responsable / agent recommandé: UX/UI Guardian

Type d'action: Accessibility

Fichiers probablement concernés: composants boutons, tabs, cards, map, forms

Description: Ajouter labels accessibles, touch targets, tests VoiceOver/TalkBack.

Critères d'acceptation: Actions critiques labellisées ; auth/carte/création navigables lecteur d'écran.

Commandes de vérification: tests VoiceOver/TalkBack.

Risques: Travail transversal.

Dépendances: design P1.

Branche Git recommandée: `fix/p2-accessibility`

Notes:

### ID: MVP-P2-003

Titre: Ajouter offline partiel pour création

Priorité: P2

Source audit: `07_OFFLINE_WEAK_NETWORK_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Offline / reliability

Fichiers probablement concernés: `src/hooks/useCreateEventStore.ts`, `app/events/create/*`, `src/store/persistStorage.ts`

Description: Persister localement le brouillon de création et ajouter retry upload de base.

Critères d'acceptation: Redémarrage app ne perd pas création en cours ; upload échoué réessayable.

Commandes de vérification: tests offline manuels.

Risques: Conflit entre brouillon local et brouillon DB.

Dépendances: lifecycle P0.

Branche Git recommandée: `fix/p2-offline-drafts`

Notes:

### ID: MVP-P2-004

Titre: Optimiser performance carte/images/stats

Priorité: P2

Source audit: `03_PERFORMANCE_MOBILE_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer

Type d'action: Performance

Fichiers probablement concernés: map/search/components images/stats service

Description: Mesurer et optimiser refetch carte, thumbnails, stats fallback, images lourdes.

Critères d'acceptation: mesures cold start/carte ; pas de lag majeur sur appareils moyens.

Commandes de vérification: profiling manuel.

Risques: Optimisation prématurée.

Dépendances: P1 media/map.

Branche Git recommandée: `perf/p2-mobile-performance`

Notes:

### ID: MVP-P2-005

Titre: Déplacer création notifications côté backend

Priorité: P2

Source audit: `02_NOTIFICATIONS_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Backend notifications

Fichiers probablement concernés: Edge Functions/RPC, `src/services/notifications.service.ts`

Description: Remplacer inserts client notifications par RPC/Edge Function sécurisée.

Critères d'acceptation: Client ne crée plus notifications arbitraires ; backend valide destinataires.

Commandes de vérification: tests permissions.

Risques: Casser invitations privées.

Dépendances: RLS notifications.

Branche Git recommandée: `fix/p2-notifications-backend`

Notes:

### ID: MVP-P2-006

Titre: Ajouter quotas anti-spam avancés

Priorité: P2

Source audit: `03_ABUSE_ANTI_SPAM_TRUST_SAFETY_AUDIT.md`

Responsable / agent recommandé: Supabase Security Architect

Type d'action: Trust & safety

Fichiers probablement concernés: Supabase RPC/Edge Functions/migrations

Description: Ajouter quotas events/comments/reports/follows/uploads.

Critères d'acceptation: Quotas documentés, testés et non bloquants pour usage normal.

Commandes de vérification: tests backend.

Risques: Faux positifs.

Dépendances: P0-011.

Branche Git recommandée: `fix/p2-anti-spam`

Notes:

### ID: MVP-P2-007

Titre: Ajouter règles communautaires et modération éditoriale

Priorité: P2

Source audit: `05_LEGAL_APP_CONTENT_AUDIT.md`

Responsable / agent recommandé: GDPR / Store Compliance Officer

Type d'action: Legal / content

Fichiers probablement concernés: settings legal, report reasons

Description: Ajouter pages règles communautaires et politique de modération courte.

Critères d'acceptation: Règles accessibles ; raisons de refus/signalement cohérentes.

Commandes de vérification: revue contenu.

Risques: Besoin validation juridique.

Dépendances: P0 légal.

Branche Git recommandée: `fix/p2-community-guidelines`

Notes:

### ID: MVP-P2-008

Titre: Automatiser diagnostics data/staging

Priorité: P2

Source audit: `DATA_CLEANING_AUDIT.md`, `01_DATA_CLEANING_MVP_SEED_AUDIT.md`

Responsable / agent recommandé: QA Lead, Supabase Security Architect

Type d'action: Data operations

Fichiers probablement concernés: scripts SQL non destructifs, docs

Description: Préparer diagnostics récurrents DB/Storage et refresh staging.

Critères d'acceptation: scripts lecture seule documentés ; procédure staging reproductible.

Commandes de vérification: SQL diagnostic lecture seule.

Risques: Confusion environnement.

Dépendances: P1 seed.

Branche Git recommandée: `chore/p2-data-ops`

Notes:

## Post-MVP

### ID: MVP-POST-001

Titre: Construire web app admin

Priorité: Post-MVP

Source audit: `ADR_001`, `POST_MVP.md`

Responsable / agent recommandé: Product Owner MVP, Supabase Security Architect

Type d'action: New product surface

Fichiers probablement concernés: futur repo/app web admin

Description: Créer l'interface admin séparée pour modération complète.

Critères d'acceptation: Admin hors mobile, auth/roles/RLS dédiés.

Commandes de vérification: à définir.

Risques: Scope important.

Dépendances: ADR 001.

Branche Git recommandée: nouveau projet ou `feat/admin-web-app`

Notes:

### ID: MVP-POST-002

Titre: Réintroduire boutique/offres

Priorité: Post-MVP

Source audit: `ADR_002`, `POST_MVP.md`

Responsable / agent recommandé: Product Owner MVP

Type d'action: Feature post-MVP

Fichiers probablement concernés: shop/offers services/routes

Description: Reprendre boutique/offres uniquement quand modèle produit et paiement sont prêts.

Critères d'acceptation: scope, legal, paiement et UX validés.

Commandes de vérification: à définir.

Risques: Store/payment complexity.

Dépendances: MVP publié.

Branche Git recommandée: `feat/post-mvp-shop-offers`

Notes:

### ID: MVP-POST-003

Titre: Réintroduire missions/gamification avancée

Priorité: Post-MVP

Source audit: `ADR_002`, `POST_MVP.md`

Responsable / agent recommandé: Product Owner MVP

Type d'action: Feature post-MVP

Fichiers probablement concernés: missions/lumo/badges/leaderboard

Description: Réintroduire missions, badges, classements et XP seulement avec UX fiable.

Critères d'acceptation: pas de valeurs hardcodées, données fiables.

Commandes de vérification: à définir.

Risques: Effet gamification excessive.

Dépendances: analytics et data fiables.

Branche Git recommandée: `feat/post-mvp-gamification`

Notes:

### ID: MVP-POST-004

Titre: Réintroduire wallet/Lumo avancé

Priorité: Post-MVP

Source audit: `POST_MVP.md`, `RLS_AUDIT.md`

Responsable / agent recommandé: Product Owner MVP, Supabase Security Architect

Type d'action: Feature post-MVP

Fichiers probablement concernés: wallet/lumo services/stores/routes

Description: Construire wallet/Lumo avec règles backend, sécurité et UX claire.

Critères d'acceptation: transactions cohérentes, pas de hardcode, RLS solide.

Commandes de vérification: à définir.

Risques: Complexité économique/sécurité.

Dépendances: backend sécurisé.

Branche Git recommandée: `feat/post-mvp-wallet-lumo`

Notes:

### ID: MVP-POST-005

Titre: Creator analytics avancés

Priorité: Post-MVP

Source audit: `POST_MVP.md`, `06_PRODUCT_ANALYTICS_AUDIT.md`

Responsable / agent recommandé: Product Owner MVP

Type d'action: Feature post-MVP

Fichiers probablement concernés: creator dashboard/fans/stats

Description: Réintroduire dashboard créateur, fans et analytics avancés après instrumentation fiable.

Critères d'acceptation: données fiables, permission owner, UX utile.

Commandes de vérification: à définir.

Risques: Données trompeuses.

Dépendances: analytics minimal.

Branche Git recommandée: `feat/post-mvp-creator-analytics`

Notes:

### ID: MVP-POST-006

Titre: Push notifications avancées

Priorité: Post-MVP

Source audit: `02_NOTIFICATIONS_AUDIT.md`, `06_BUILD_RELEASE_AUDIT.md`

Responsable / agent recommandé: Mobile Reliability Engineer, Release Manager

Type d'action: Notifications post-MVP

Fichiers probablement concernés: notification service, app config permissions, backend triggers

Description: Ajouter push notifications après inbox fiable, permissions prêtes et backend sécurisé.

Critères d'acceptation: expo-notifications ou solution choisie, opt-in, permissions stores, routing sûr.

Commandes de vérification: tests push iOS/Android.

Risques: Permissions/store complexity.

Dépendances: notifications backend.

Branche Git recommandée: `feat/post-mvp-push-notifications`

Notes:
