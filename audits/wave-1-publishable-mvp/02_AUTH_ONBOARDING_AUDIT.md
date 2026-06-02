# 02 - Auth & Onboarding Audit

## Résumé exécutif

Le socle auth fonctionne autour de Supabase Auth, d'un profil applicatif et d'un onboarding conditionné par `profile.onboarding_completed`. Le mode invité existe et reste principalement orienté découverte carte, ce qui est cohérent pour Moments Locaux.

Les risques principaux concernent la cohérence entre les deux chemins d'initialisation auth, le logout biométrique qui conserve volontairement les tokens, l'absence de consentement CGU/privacy visible à l'inscription, et le cas d'un utilisateur authentifié sans profil applicatif.

Niveau de préparation : moyen. Le flux est utilisable, mais plusieurs cas limites peuvent créer des boucles, des états incomplets ou des réserves store/privacy.

## Constats

### Login

- `src/screens/auth/LoginScreen.tsx` supporte email/password.
- Le mode invité redirige vers `/(tabs)/map`.
- La biométrie est proposée si une session sauvegardée existe.
- Les utilisateurs invités sont bloqués par des gates sur les actions protégées.

### Register

- `src/screens/auth/RegisterScreen.tsx` crée un compte email/password.
- Si Supabase impose une confirmation email, l'utilisateur est renvoyé vers login.
- Le profil est créé immédiatement uniquement si une session existe après signup.
- Aucun lien ou consentement explicite CGU / politique de confidentialité n'a été identifié dans l'écran d'inscription.

### Session persistée

- `src/services/auth.service.ts` stocke les tokens Supabase dans SecureStore pour permettre la reconnexion biométrique.
- `signOut()` effectue un soft logout : il pose un flag de blocage et ne révoque pas réellement la session Supabase.
- Ce choix peut être acceptable si la biométrie est une feature assumée, mais il nécessite un libellé clair et une option de déconnexion complète.

### Initialisation auth

- `app/_layout.tsx` initialise directement session/user/profile via `AuthService`.
- `src/hooks/useAuth.ts` contient aussi une logique d'initialisation.
- Le hook vérifie `AuthService.isAutoRestoreBlocked()`, mais le RootLayout ne semble pas appliquer la même règle.
- Comme le RootLayout peut marquer l'état auth comme initialisé, le hook peut ne pas corriger certains états.

### Onboarding

- `app/index.tsx` redirige vers `/onboarding` si `profile && !profile.onboarding_completed`.
- Si l'utilisateur est authentifié mais que `profile` est absent, la redirection onboarding ne se déclenche pas.
- `ensureProfile` existe côté `auth-provider`, mais le chemin RootLayout ne garantit pas explicitement sa création en cas de profil manquant.

### Guest mode

- Le guest mode est cohérent pour la carte.
- Les actions sociales, création, communauté et profil nécessitent une session.
- Il faut vérifier que chaque entrée protégée affiche une gate claire et ne laisse pas arriver sur un écran cassé.

### Biométrie

- La biométrie est fonctionnelle dans le code.
- Elle reste une feature sensible en store review, car elle implique SecureStore, Face ID/biométrie et une promesse de sécurité.
- Si conservée, elle doit être explicitement justifiée et offrir une déconnexion complète.

## Risques

- Boucle ou état incohérent après soft logout.
- Utilisateur authentifié sans profil, donc sans onboarding clair.
- Compte créé sans acceptation traçable des CGU/privacy.
- Confusion utilisateur entre "déconnexion" et "session conservée pour biométrie".
- Biometric login perçu comme avancé pour un MVP si le parcours n'est pas parfaitement expliqué.

## Recommandations

- Centraliser l'initialisation auth dans un seul chemin.
- Faire respecter `isAutoRestoreBlocked()` dans le RootLayout ou déplacer toute l'init dans le store/hook.
- Ajouter un fallback obligatoire : session présente + profil absent => `ensureProfile`, puis onboarding.
- Ajouter liens CGU/privacy et consentement au register.
- Décider produit : conserver biométrie avec vrai wording + full logout, ou masquer jusqu'au post-MVP.
- Ajouter un bouton "Oublier cet appareil" si biométrie conservée.

## Quick wins

- Ajouter liens CGU/privacy dans Register/Login.
- Ajouter une mention simple au login biométrique.
- Ajouter une route de récupération profil absent.
- Renommer le comportement soft logout pour ne pas promettre une déconnexion complète.

## Points bloquants MVP

- P0 : inscription sans acceptation CGU/privacy explicite.
- P0 : suppression/oubli de session non claire si biométrie conservée.
- P0 : cas profil absent non traité de manière robuste.
- P1 : initialisation auth dupliquée.
- P1 : wording biométrie/store à clarifier.

## Priorisation

### P0

- Ajouter consentement CGU/privacy à l'inscription.
- Garantir session + profil absent => création/réparation profil + onboarding.
- Clarifier ou désactiver la biométrie pour le MVP.

### P1

- Unifier RootLayout et `useAuth`.
- Ajouter tests manuels : login, register, email confirmation, logout, guest, onboarding incomplet.

### P2

- Ajouter gestion avancée des sessions.
- Ajouter suppression locale des credentials biométriques depuis settings.

## Fichiers concernés

- `app/_layout.tsx`
- `app/index.tsx`
- `src/hooks/useAuth.ts`
- `src/services/auth.service.ts`
- `src/data-provider/auth-provider.ts`
- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/RegisterScreen.tsx`
- `src/screens/onboarding/OnboardingScreen.tsx`
