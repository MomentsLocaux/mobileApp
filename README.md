# Technical Foundation - React Native/Expo Project

Production-grade technical scaffold for a mobile application built with Expo and React Native.

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

Create a `.env` file based on `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

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

This is a **technical foundation only**. To build your application:

1. Add business logic to placeholder screens
2. Implement data models and Supabase queries
3. Configure Mapbox with your use case
4. Create domain-specific components
5. Add business features and flows

## License

Private project scaffold.
