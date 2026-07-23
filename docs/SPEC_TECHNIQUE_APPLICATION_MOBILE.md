# Spécification technique — Application mobile Moments Locaux

| Métadonnée | Valeur |
|---|---|
| **Produit** | Moments Locaux |
| **Document** | Spécification technique — application mobile (D2) |
| **Version** | 1.0 |
| **Date** | 2026-07-23 |
| **Statut** | Vivant (rétro-ingénierie code + docs + audits) |
| **Audience** | Mobile eng., QA tech, Supabase Security, Release |
| **Complément** | Spec fonctionnelle D1 — `docs/SPEC_FONCTIONNELLE_APPLICATION_MOBILE.md` |

---

## 1. Objet / hors-scope

### Objet

Décrire **comment** l’application mobile est construite : stack, architecture, auth, données, modules techniques MVP, feature flags, sécurité, qualité.

### Hors-scope

- Specs fonctionnelles détaillées (→ D1)
- Console d’administration (→ D3 / D4)
- Application des migrations Supabase (validation humaine obligatoire)
- Contenu marketing / store listing

---

## 2. Contexte produit (rappel technique)

Boucle MVP : découvrir → consulter → créer/soumettre → interagir → check-in → signaler → notifications → compte.

- Modération ops **hors mobile** (ADR 001) — routes `/moderation/*` redirigées.
- Backend : **Supabase** (Auth, PostgREST, Realtime, Storage, Edge Functions).
- Carte : **Mapbox** (`@rnmapbox/maps`).
- Un codebase Git ; backends DEV / UAT via fichiers env (`docs/GIT_AND_ENVIRONMENTS.md`).

---

## 3. Stack & runtime

| Couche | Choix | Version (constat repo) |
|---|---|---|
| Runtime | Expo | SDK `~54.0.25` |
| Framework | React Native | `0.81.5` |
| UI | React | `19.1.0` |
| Navigation | Expo Router | `~6.0.15` |
| Langage | TypeScript | `~5.9.2` |
| Backend client | `@supabase/supabase-js` | `^2.58.0` |
| Carte | `@rnmapbox/maps` (+ `mapbox-gl` web) | `^10.2.7` |
| État | Zustand | `^5.0.8` |
| Forms / validation | react-hook-form, zod | — |
| Push | `expo-notifications` | `^0.32.17` |
| Localisation | `expo-location` | `^19.0.7` |
| Secrets locaux | `expo-secure-store` | `^15.0.7` |

| Identifiant | Valeur |
|---|---|
| Bundle / package | `com.momentslocs.app` |
| Scheme | `momentslocaux` |
| New Architecture | `newArchEnabled: true` |
| Entry | `expo-router/entry` |
| Config runtime | `app.config.ts` (enrichit `app.json`) |

**Permissions OS (extrait)**

- iOS : photothèque, caméra, localisation (when-in-use + always), Face ID ; background `location` + `remote-notification`.
- Android : `ACCESS_*_LOCATION`, `CAMERA`, `POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES` / storage ; `google-services.json`.

**Garde-fou build** (`app.config.ts`) : refuse les `EXPO_PUBLIC_*` dont le nom suggère `SERVICE|SECRET|PRIVATE`.

**Observabilité** : `EXPO_PUBLIC_SENTRY_DSN` prévu dans `.env.example` / MVP_SCOPE, mais **SDK Sentry absent** du `package.json` à date (dette store).

---

## 4. Architecture applicative

```
app/                    # Routes file-based (Expo Router)
src/
  components/           # UI réutilisable
  config/               # Feature flags (*.flags.ts)
  hooks/                # useAuth, push, etc.
  services/             # Accès données / API / Edge
  state/                # Stores actifs (ex. auth)
  store/                # Stores legacy / UI (ex. map)
  screens/              # Écrans parfois partagés avec routes
  types/                # Types domaine / DB
supabase/
  functions/            # Edge Functions
  migrations/           # Schéma / RLS (ne pas appliquer sans validation)
```

### Bootstrap navigation

`app/index.tsx` :

1. Chargement session / profil  
2. Non auth → `/auth/login`  
3. Auth + onboarding incomplet → `/onboarding`  
4. Sinon → `/(tabs)/map`

Root stack (`app/_layout.tsx`) : tabs, auth, events, notifications, settings, discovery/contests (flaggés), etc.

### Feature flags

| Flag | Fichier | Variable | Défaut |
|---|---|---|---|
| Gamification | `src/config/gamification.flags.ts` | `EXPO_PUBLIC_GAMIFICATION_ENABLED` | `false` (+ miroir serveur `app_config` possible) |
| Discovery | `src/config/discovery.flags.ts` | `EXPO_PUBLIC_DISCOVERY_ENABLED` | `false` |
| Discovery capture | idem | `EXPO_PUBLIC_DISCOVERY_CAPTURE_ENABLED` | `false` |
| Concours | `src/config/contests.flags.ts` | `EXPO_PUBLIC_FEATURE_CONTESTS` | `false` |

Si flag off : layouts / écrans concernés font `Redirect` vers `/(tabs)/map` (ou `/settings` pour certains placeholders).

### Data provider

Façade Supabase côté client (clé **anon** uniquement). Check-in legacy HTTP et achats shop désactivés pour le MVP ; check-in = Edge `event-checkin`.

---

## 5. Auth & session

| Élément | Implémentation |
|---|---|
| Store **actif** | `src/state/auth.ts` (`useAuthStore` Zustand) via `src/hooks/useAuth.ts` |
| Store **legacy** | `src/store/authStore.ts` (exporté, non branché au flux auth) |
| Email / password | `src/services/auth.service.ts` |
| OAuth | `src/services/oauth.service.ts` + `SocialLoginButtons` ; providers `google` \| `apple` \| `facebook` |
| Callback | `app/auth/callback.tsx` → `completeAuthRedirectFromUrl` |
| Redirect URI | `Linking.createURL('auth/callback' \| 'auth/reset-password')` → `momentslocaux://…` |
| Biométrie | SecureStore + Face ID / équivalent |
| Invité | Accès carte ; actions protégées → GuestGate |

`isAuthenticated` côté hook : dérivé de `!!session`.

---

## 6. Couche données

### 6.1 Tables / domaines touchés (MVP)

`profiles`, `events`, `event_media`, `event_media_submissions`, `event_comments`, `event_likes`, `comment_likes`, `event_interests`, `event_checkins`, `favorites`, `follows`, `reports`, `notifications`, `user_preferences`, `bug_reports`, `moderation_actions` / `warnings` (lecture limitée / écriture admin).

Modules flaggés : wallets / missions / shop ; `discovery_*` ; contests / entries.

### 6.2 RLS (principes — détail dans audits)

- Clients mobiles = JWT user + anon key ; **pas** de service role embarqué.
- Insert reports / bug_reports par user authentifié.
- Files de modération, warnings, actions admin : **pas** lisibles / mutables depuis un user standard.
- Transitions `pending` → `published` / `refused` / `archived` : protégées côté serveur (console + RLS / RPC).
- Réf. : `audits/wave-1-publishable-mvp/04_SUPABASE_RLS_AUDIT.md`, `audits/standalone-audits/RLS_AUDIT.md`.

### 6.3 Edge Functions

| Function | Rôle |
|---|---|
| `event-checkin` | Check-in géoloc (rayon typ. ≤ 500 m) + effets optionnels Lumo |
| `delete-account` | Suppression compte + nettoyage storage (service role **côté function**) |
| `push-dispatch` | Sur INSERT `notifications` → Expo Push (APNs/FCM) |
| `discovery-ingest` | Ingestion / clustering visites (flag Discovery) |
| `discovery-score` | Ranking reco (flag Discovery) |
| `subscription-webhook` | Webhooks abonnements (post-MVP / Discovery+) |

### 6.4 Storage buckets (env)

| Variable | Défaut typique |
|---|---|
| `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET` | `avatar` |
| `EXPO_PUBLIC_SUPABASE_EVENT_COVER_BUCKET` | `event-media` |

---

## 7. Modules techniques par domaine

### 7.1 Événements

- Service : `src/services/events.service.ts`
- Création active : `app/events/create/*` (stepper) — **pas** le legacy `src/screens/events/EventCreateScreen.tsx`
- Statuts : `draft` → `pending` (soumission mobile) → `published` \| `refused` \| `archived` (console)
- Édition UI : `draft` \| `refused` uniquement
- Géocodage création : `geocoding.service.ts` / Mapbox
- Médias : upload Storage + `event-media-submissions` pour échos

### 7.2 Carte

- Écran : `app/(tabs)/map.tsx` + store UI map
- Orchestration : `docs/MAP_SCREEN_ORCHESTRATION.md`
- Flux : map ready → bounds → `queueViewportFetch` / `runViewportFetch` → markers ; debounce bounds ~300 ms ; freeze viewport si sheet / marker ; search → fit bounds + refresh ; deep-link `focus` → pipeline marker
- Annulation requêtes via `requestId`

### 7.3 Social

- `social.service.ts` : likes, favoris (cœur unifié côté UI)
- `community.service.ts` : follow, membres, leaderboard
- Profils : `/community/[id]`, `/creator/[id]` (hub analytics redirect hors MVP)

### 7.4 Check-in

- `checkin.service.ts` → Edge `event-checkin`
- Modes : QR caméra et/ou distance géoloc
- QR web / scheme : `EXPO_PUBLIC_EVENT_QR_*`

### 7.5 Signalements

- `report.service.ts` → insert `reports` (`event` \| `comment` \| `user` \| `media`)
- Traitement : console admin uniquement

### 7.6 Notifications

| Canal | Mécanisme |
|---|---|
| Inbox | Table `notifications` + Realtime (`notifications.service.ts`) |
| Push | `push.service.ts` (token Expo) + Edge `push-dispatch` |
| Préférences | `preferences.service.ts` → `user_preferences` |
| E-mail Auth | Brevo SMTP (signup / reset) — **pas** canal push produit |

Détail : `docs/notifications/CHANNELS.md` ; runbook ops push sous `infra/` / docs runbooks.

### 7.7 Profil / compte / bugs

- `profile.service.ts`, `user.service.ts`
- Delete : Edge `delete-account` depuis settings privacy
- Bugs : `bugs.service.ts` → `bug_reports`

### 7.8 Modules dormants (code présent)

`moderation.service.ts`, `lumo.service.ts`, `missions.service.ts`, `shop.service.ts`, `pass.service.ts`, `creatorStats` / `creatorFans`, `src/services/discovery/*` — gardés par flags / redirects ; achats shop provider bloqués en MVP.

---

## 8. Feature flags & environnements

### Variables `EXPO_PUBLIC_*` (extrait `.env.example`)

| Variable | Rôle |
|---|---|
| `EXPO_PUBLIC_APP_ENV` | Env logique (`dev` / …) |
| `EXPO_PUBLIC_SUPABASE_URL` | Projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Token runtime Mapbox |
| `EXPO_PUBLIC_SENTRY_DSN` | Prévu (SDK à brancher) |
| Flags Discovery / Contests / Gamification | Voir §4 |
| `EXPO_PUBLIC_EVENT_QR_*` | Base URL / scheme QR |

Non publiques (CI / local) : tokens download Mapbox, `EAS_PROJECT_ID`, service role (Edge / scripts **uniquement**, jamais dans le binaire mobile).

### Scripts utiles

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm run dev          # expo start
npm run dev:uat      # .env.uat → .env.local + start -c
npm run dev:dev      # retire .env.local + start -c
npx expo config      # config/release
```

---

## 9. Sécurité & privacy

| Règle | Application |
|---|---|
| Pas de service role dans le client | Anon + JWT user ; EF privileged côté serveur |
| UI hiding ≠ authz | Redirects + RLS + console admin |
| Deep links admin | `/moderation/*` → map |
| Suppression compte | Store requirement → `delete-account` |
| Permissions | Copy iOS Info.plist / Android Play à valider en build prod |
| Secrets dans env | Garde-fou `SERVICE\|SECRET\|PRIVATE` sur `EXPO_PUBLIC_*` |
| Sentry | DSN prévu ; **intégration SDK à compléter** avant store |

---

## 10. Observabilité & qualité

| Contrôle | Commande / artefact |
|---|---|
| Types | `npm run typecheck` |
| Lint | `npm run lint` |
| Config Expo | `npx expo config` |
| Matrice manuelle | `MVP_SCOPE.md` § Critical Manual Test Matrix |
| Notifs QA | `docs/notifications/QA_MATRIX.md` |
| Audits | `audits/wave-1-*`, `audits/wave-2-*` |

---

## 11. Diagrammes de séquence

### 11.1 Soumission événement → publication

```
Créateur (mobile)          Supabase                Console admin
      |                        |                         |
      | insert/update draft    |                         |
      |----------------------->|                         |
      | status = pending       |                         |
      |----------------------->|                         |
      |                        | list pending            |
      |                        |<------------------------|
      |                        | approve → published     |
      |                        | + qr_token              |
      |                        |<------------------------|
      | (notif event_published / inbox)                  |
      |<-----------------------|                         |
      | event visible map/list |                         |
```

### 11.2 Check-in

```
User → checkin.service → Edge event-checkin
                         ├─ vérif auth + event published
                         ├─ vérif distance / token QR
                         ├─ insert event_checkins
                         └─ side-effects optionnels (Lumo si flag serveur)
```

### 11.3 Push

```
INSERT notifications → trigger / push-dispatch → Expo Push → APNs/FCM
                     → Realtime → inbox mobile (badge / liste)
Préférences user_preferences filtrant l’éligibilité côté génération / dispatch
```

---

## 12. Mapping parcours D1 → implémentation

| Parcours D1 | Points d’entrée techniques |
|---|---|
| Auth / OAuth / invité | `app/auth/*`, `auth.service`, `oauth.service`, `state/auth` |
| Onboarding | `app/onboarding`, `profile.service` |
| Carte / recherche | `app/(tabs)/map.tsx`, `mapbox.service`, orchestration doc |
| Accueil / liste | `app/(tabs)/index` |
| Fiche + échos | `app/events/[id]`, `echoes`, `comments`, media submissions |
| Création / mes events | `app/events/create/*`, `profile/my-events`, `events.service` |
| Social | `social.service`, `community.service` |
| Check-in | `checkin.service` → `event-checkin` |
| Reports | `report.service` |
| Notifications | `notifications.service`, `push.service`, `preferences.service` |
| Settings / delete / bugs | `app/settings/*`, `delete-account`, `bugs.service` |

---

## 13. Exigences non fonctionnelles (techniques)

| ID | Exigence | Vérification |
|---|---|---|
| NFR-T1 | `typecheck` et `lint` verts après changement applicatif | CI / local |
| NFR-T2 | Aucun secret service role dans le bundle | Review `app.config` + grep |
| NFR-T3 | Flags post-MVP off par défaut | `.env.example` |
| NFR-T4 | Routes admin inaccessibles | Redirect + smoke deep link |
| NFR-T5 | Check-in et delete via Edge Functions | Tests manuels matrice |
| NFR-T6 | Push : permission OS + préférences | QA_MATRIX notifications |

---

## 14. Annexes

### A. Inventaire `src/services/` (racine)

`activity-log`, `auth`, `bugs`, `checkin`, `comments`, `community`, `creator-boost`, `creatorFans`, `creatorStats`, `early-access`, `event-card-stats`, `event-media-submissions`, `events`, `geocoding`, `local-status`, `lumo`, `mapbox`, `missions`, `moderation`, `notifications`, `oauth`, `pass`, `preferences`, `profile`, `push`, `report`, `shop`, `social`, `subscription`, `user` (+ dossier `discovery/`).

### B. Routes gardées (patterns)

| Pattern | Comportement |
|---|---|
| `/moderation/*` | → map |
| `/creator/dashboard`, `/creator/fans` | → map |
| Shop / missions / wallet / pass | → map si `!GAMIFICATION` |
| `/discovery/*`, subscription discovery | → map / settings si `!DISCOVERY` |
| `/contests/*` | → map si `!CONTESTS` |
| Settings placeholders (email, sessions, export…) | → `/settings` |

### C. Dette technique connue

- Doublon auth : `src/state/auth.ts` (actif) vs `src/store/authStore.ts` (legacy)
- `EventCreateScreen` legacy non branché
- Sentry DSN sans SDK package
- `moderation.service` mobile encore présent (UI redirigée)
- Settings avancés = redirects
- `expo-file-system/legacy` encore utilisé à certains endroits
- Achats shop : throw / disabled en provider MVP

---

## 15. Documents liés

| Document | Rôle |
|---|---|
| D1 Spec fonctionnelle mobile | Comportement métier |
| `MVP_SCOPE.md`, ADR 001/002 | Scope & décisions |
| `docs/PLAN_DOCUMENTATION_PRODUIT.md` | Plan D3–D5 |
| `docs/MAP_SCREEN_ORCHESTRATION.md` | Détail carte |
| `docs/notifications/CHANNELS.md` | Canaux notifs |
| `docs/GIT_AND_ENVIRONMENTS.md` | Env DEV/UAT |
| Audits Wave 1–2 | RLS, media, map, build, errors |

---

## 16. Historique

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-07-23 | Première version D2 selon plan documentaire |
