# 04 - Error Handling & Observability Audit

## Résumé exécutif

L'application contient de nombreux `try/catch`, `Alert.alert`, `Toast` et `console.warn`, ce qui évite certains crashs visibles. En revanche, l'observabilité production reste insuffisante : pas de Sentry équivalent identifié, logs console nombreux, erreurs parfois silencieuses, et messages utilisateur inégaux.

Niveau actuel : acceptable en dev, insuffisant pour bêta large.

## Constats

### Erreurs Supabase

- `formatSupabaseError` ajoute contexte, code, details et hint.
- Certains messages RLS sont utiles pour dev, mais peuvent être trop techniques pour production.
- Plusieurs services lancent directement `new Error(error.message)`.
- Les erreurs critiques sont parfois transformées en fallback silencieux.

### Erreurs Mapbox

- `MapboxService.search` retourne `[]` si erreur HTTP.
- `reverse` retourne `null`.
- L'utilisateur peut confondre erreur API et absence de résultats.

### Erreurs upload

- `CoverImageUploader` catch l'erreur, log `console.warn`, clear l'image et ne montre pas de message utilisateur.
- `EventPhotoContributionModal` affiche une alerte avec le message d'erreur.
- `ProfileEditScreen` affiche des alertes simples.

### Erreurs auth

- `useAuth` garde un `error` dans le store.
- RootLayout et hook init loggent certaines erreurs.
- Le cas profil manquant reste à traiter plus clairement.

### Logs console

- Nombreux `console.warn` et `console.error`.
- Peu ou pas de filtrage `__DEV__`.
- Risque de logs sensibles en production, notamment erreurs Supabase détaillées.

### Erreurs silencieuses

- `trackEventView` ignore les erreurs Supabase.
- `EventCardStatsService` fallback si RPC échoue.
- Recherche Mapbox et counts peuvent revenir vides sans explication.
- Certaines actions sociales loggent seulement en console.

### Bug report flow

- Un bug report flow existe côté UI.
- Les `bug_reports` doivent être protégés côté RLS, car ils peuvent contenir des données sensibles.
- Aucun lien automatique entre crash/log technique et bug report utilisateur n'a été identifié.

### Observabilité production

- Aucune intégration Sentry, Bugsnag ou équivalent n'a été identifiée.
- Pas de stratégie de redaction des erreurs.
- Pas de crash reporting natif.

## Risques

- Utilisateur bloqué sans comprendre.
- Erreurs upload/carte silencieuses.
- Données sensibles exposées dans logs production.
- Impossible de diagnostiquer crashs bêta.
- Régressions RLS invisibles sans monitoring.
- Store review touchant un écran cassé sans trace exploitable.

## Recommandations

- Ajouter une couche `logger` centralisée avec niveaux dev/prod et redaction.
- Remplacer les logs directs sensibles par `logger.warn/error`.
- Ajouter crash reporting avant bêta sérieuse.
- Standardiser les messages utilisateur :
  - auth
  - upload
  - carte/recherche
  - Supabase/RLS
  - réseau faible
- Distinguer erreurs techniques et messages UX.
- Garder les détails Supabase uniquement en dev.
- Ajouter un mode "copier diagnostic" dans bug report post-MVP ou P1.

## Quick wins

- Wrap console logs derrière `__DEV__` pour les détails techniques.
- Ajouter Alert/Toast sur échec upload cover.
- Ajouter message "connexion instable" pour recherche/carte.
- Vérifier que bug reports ne sont pas lisibles publiquement.
- Lister les erreurs P0 avec reproduction manuelle.

## Fichiers concernés

- `src/data-provider/supabase-provider.ts`
- `src/services/mapbox.service.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useLocation.ts`
- `src/hooks/useImagePicker.ts`
- `src/components/events/CoverImageUploader.tsx`
- `src/components/events/EventPhotoContributionModal.tsx`
- `src/screens/profile/ProfileEditScreen.tsx`
- `src/services/notifications.service.ts`
- `app/bug-report.tsx`

## Scénarios à tester

- Supabase indisponible.
- Token Mapbox absent.
- Réseau coupé pendant recherche.
- Réseau coupé pendant upload cover.
- Permission caméra refusée.
- Permission photos refusée.
- Login avec mauvais mot de passe.
- Profil absent après login.
- RLS refusant update événement.
- RPC stats absente.
- Bug report soumis sans réseau.
- Notification realtime indisponible.

## Priorisation

### P0

- Empêcher logs sensibles en production.
- Afficher erreurs utilisateur pour upload, auth, recherche et carte.
- Protéger bug reports côté RLS.

### P1

- Ajouter crash/error reporting.
- Centraliser logger.
- Standardiser messages d'erreur.

### P2

- Ajouter diagnostics utilisateur avancés.
- Ajouter métriques produit/tech.
- Ajouter alerting backend.
