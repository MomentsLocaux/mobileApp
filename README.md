# Moments Locaux — Application Mobile (Expo / React Native)

Application mobile Moments Locaux (Expo + React Native), structurée pour un parcours MVP complet (auth, onboarding, découverte map, création event, check-in, notifications, profil & reporting).

## Tech Stack

### Core
- **Expo SDK 54+** - Cross-platform framework
- **React Native** - Mobile UI framework
- **TypeScript** (strict mode) - Type safety
- **Expo Router** - File-based navigation
- **React Native Reanimated 3** - Animations
- **Zustand** - State management

### Backend & Services
- **Supabase** - Authentication & database
- **Mapbox GL** - Maps integration
- **Sentry** - Error tracking
- **Edge Functions** - Serverless functions

### Location & Security
- **Expo Location** - Location services
- **Expo SecureStore** - Secure storage

## Project Structure

```
/src
  /components
    /ui          - Reusable UI primitives (Button, Input, Card, Icon)
    /map         - Map components (MapView)
  /screens
    /Auth        - Authentication screens (Login, Register)
    /Main        - Main app screens (Home, Map, Profile)
  /hooks         - Custom React hooks (useAuth, useLocation)
  /store         - Zustand stores (auth, location, app)
  /services      - Business logic services (auth.service)
  /lib           - Third-party integrations (supabase, edge, sentry)
  /types         - TypeScript type definitions
  /constants     - App constants and configuration
  /theme         - Design system (colors, spacing, typography)
```

## Features

### Authentication Flow
- Email/password authentication via Supabase
- Protected routes
- Auth state management
- Login & Register screens

### Navigation
- Tab-based primary navigation (Home, Map, Profile)
- Stack navigation for auth flow
- Deep linking support

### UI System
- Complete design system with color ramps
- 8px spacing system
- Typography scale
- Reusable UI components

### State Management
- Auth store (user, session)
- Location store (current location, permissions)
- App store (global app state)

### Integrations
- Supabase client initialized
- Mapbox configured
- Sentry error tracking
- Edge function utilities

## Environment Variables

```bash
cp .env.example .env
```

Required for local dev:

- `EXPO_PUBLIC_SUPABASE_URL` (same Supabase project as admin / scrapper)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_MAPBOX_TOKEN`

Cross-repo env checklist and release candidate process: `Moments-Locaux-Scrapper/docs/ENV_CHECKLIST.md` and `docs/RELEASE_CANDIDATE.md`.

Only `EXPO_PUBLIC_*` values are available in the mobile app bundle. Never prefix service-role, private, or secret values with `EXPO_PUBLIC_`.

Server-only values such as `SUPABASE_SERVICE_ROLE_KEY` are reserved for local admin scripts, CI secrets, or Supabase Edge Function runtime secrets. They are not exposed through `app.config.ts`.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`

3. Start development server:
```bash
npm run dev
```

4. Build for web:
```bash
npm run build:web
```

## Available Scripts

- `npm run dev` - Start Expo development server
- `npm run build:web` - Build web version
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Architecture Notes

### Path Aliases
All imports use path aliases configured in `tsconfig.json` and `babel.config.js`:
- `@/components/*` - UI components
- `@/screens/*` - Screen components
- `@/hooks/*` - Custom hooks
- `@/store/*` - Zustand stores
- `@/lib/*` - Third-party integrations
- `@/theme/*` - Design system

### Placeholder Screens
All screens are placeholder implementations ready for business logic:
- LoginScreen - Auth form
- RegisterScreen - Registration form
- HomeScreen - Main dashboard
- MapScreen - Mapbox map view
- ProfileScreen - User profile

### Custom Hooks
- `useAuth()` - Authentication state and methods
- `useLocation()` - Location permissions and current position

### Services
- `AuthService` - Supabase authentication wrapper
- `callEdge()` - Edge function utility

## Next Steps

Le projet contient déjà un socle MVP opérationnel. Pour étendre les fonctionnalités :

1. Add business logic to placeholder screens
2. Implement data models and Supabase queries
3. Configure Mapbox with your use case
4. Create domain-specific components
5. Add business features and flows

## License

Private project scaffold.


# 📱 Moments Locaux — Application Mobile

Application mobile React Native/Expo (Dev Client + modules natifs), développée avec :
- Expo SDK
- React Native
- @rnmapbox/maps (Carte Mapbox)
- TypeScript
- VS Code + Copilot/Codex
- iOS dev-client pour tests sur appareil réel

---

## 🚀 Démarrer le projet

### 1. Installer les dépendances
```
npm install
```

### 2. Lancer en mode dev-client
L’app doit être installée sur l’iPhone via Xcode (dev client Expo).
```
npx expo start --dev-client
```

### 3. Nettoyer le cache si besoin
```
npx expo start --dev-client --clear
```

---

## 🏗️ Structure du projet

```
app/          # écrans Expo Router (ou src/ si choisi)
components/   # composants UI réutilisables
lib/          # logique métier, hooks, utilitaires
assets/       # icônes, splash, images
ios/          # projet iOS généré (ne pas éditer manuellement sauf nécessité)
android/      # projet Android généré (idem)
```

---

## 🔩 Ajouter un module natif (Mapbox, Camera, Audio…)

1. Installer la dépendance :
```
npm install <lib>
# ou: expo install <lib>
```

2. Regénérer les projets natifs :
```
npx expo prebuild -p ios
cd ios
pod install
cd ..
```

3. Rebuild du dev-client dans Xcode :
- Ouvrir `ios/<APP>.xcworkspace`
- Sélectionner l'iPhone
- Build & run (installe un nouveau dev client)

4. Relancer le dev server :
```
npx expo start --dev-client
```

---

## 🧪 Tests sur iPhone réel

- Lancer Metro : `npx expo start --dev-client`
- Ouvrir l’application *dev client* installée via Xcode
- Le téléphone et le Mac doivent être sur **le même réseau Wi-Fi**

---

## 🌲 Git Workflow recommandé

### Branches
- `main` — stable
- `feature/...` — développements
- `fix/...` — corrections

### Cycle standard
```
git checkout -b feature/mapbox-improve
git add .
git commit -m "feat: improve map gestures and clustering"
git push origin feature/mapbox-improve
```

---

## 🧰 Commandes utiles

```
# Diagnostiquer un problème de config
npx expo doctor

# Vérifier le bundle iOS natif
cd ios && pod install && cd ..

# Effacer caches (cas ultime)
rm -rf node_modules
rm -rf ios/Pods
npm install
npx expo prebuild -p ios
cd ios && pod install && cd ..
```

---

## 🧭 Notes importantes

- **Ne pas faire de `expo prebuild` inutilement.**
  Seulement après ajout/modification de modules natifs.
- **Commits natifs clairs** :
  - `chore(ios): prebuild & pods after adding Mapbox`
- Le code métier doit rester **100% dans JS/TS**, *jamais* dans `ios/*`.

---

## 🔐 Identité & Build

- Le bundle ID iOS se règle dans `app.json`
- Les icônes & splash sont dans `assets/`

---

## 🏁 Licence
Projet interne Moments Locaux — Tous droits réservés.
