# 06 - GDPR / Store Compliance Audit

## Résumé exécutif

Moments Locaux traite des données personnelles et des contenus générés par les utilisateurs : identité de profil, email via Supabase Auth, localisation, événements, médias, commentaires, favoris, follows, check-ins, notifications, reports et bug reports. Le MVP peut être compatible store, mais plusieurs points sont bloquants avant publication.

Les deux plus importants sont la suppression de compte réellement fonctionnelle et la protection des données sensibles côté RLS. Les pages légales existent, mais leur contenu doit être finalisé et accessible dès l'inscription.

Niveau de préparation : partiel. Les écrans de base existent, mais conformité et enforcement doivent être renforcés.

## Constats

### Données personnelles collectées

- Email et identité auth via Supabase Auth.
- Profil : nom, avatar, bio, rôle, onboarding, préférences éventuelles.
- Localisation : utilisée pour afficher événements proches et check-in.
- Médias : avatars, covers, photos d'événements.
- Interactions : favoris, likes, follows, commentaires.
- Check-ins : présence à un événement, potentiellement coordonnées.
- Notifications : destinataire, contenu, statut lu/non lu.
- Reports et bug reports : messages libres, contexte, cible signalée.

### Contenus générés par les utilisateurs

- Profils publics.
- Événements.
- Photos/covers.
- Commentaires et replies.
- Signalements.
- Bug reports.
- Check-ins et interactions sociales.

### Écrans nécessaires

Présents ou partiellement présents :

- Politique de confidentialité.
- Conditions générales d'utilisation.
- Mentions légales.
- Suppression compte.
- Signalement événement.
- Signalement commentaire.
- Signalement profil/utilisateur.

À finaliser :

- Contenu juridique réel, non placeholder.
- Contact support/privacy.
- Consentement CGU/privacy à l'inscription.
- Flux de suppression compte fonctionnel.
- Raison de refus visible pour les événements refusés.

### Suppression de compte

- `app/settings/privacy/delete.tsx` affiche un écran et une confirmation.
- L'action destructive ne lance pas de vraie suppression/anonymisation.
- Il faut définir ce qui est supprimé, anonymisé ou conservé temporairement.
- Les médias Supabase Storage doivent être inclus dans le plan.
- `auth.users` ne doit pas être touché sans flow validé, idéalement via Edge Function service role.

### Signalement et modération

- Les mécanismes utilisateur de signalement existent.
- La modération admin mobile doit être retirée du MVP.
- Les reports doivent être lisibles uniquement par admin/service-side, pas par tous les clients.

### Permissions mobiles

Permissions justifiables MVP :

- Localisation : événements proches et check-in.
- Caméra : QR scan et prise/upload photo.
- Photos/médias : upload covers, avatars, photos événement.
- Notifications : si push/in-app activées.
- Biométrie : uniquement si reconnexion biométrique gardée.

Points à vérifier :

- Textes iOS clairs et en français.
- Android 13+ : permission notifications explicite si push.
- Microphone absent ou supprimé si non utilisé.
- Demande de localisation au bon moment, pas trop tôt dans l'expérience.

## Risques

- Rejet store si suppression de compte non fonctionnelle.
- Rejet ou réserve si CGU/privacy non accessibles au register.
- Exposition de check-ins, bug reports ou reports via RLS.
- Médias publics non maîtrisés.
- Soft logout biométrique mal compris.
- Absence de contact privacy/support.
- Modération admin visible dans mobile alors que non prévue.

## Recommandations

- Implémenter une suppression compte réelle via Edge Function :
  - anonymiser contenus publics conservés
  - supprimer données privées
  - supprimer ou détacher médias
  - supprimer Auth user ou planifier suppression
- Finaliser politique de confidentialité, CGU, mentions légales et contact.
- Ajouter acceptation CGU/privacy à l'inscription.
- Retirer modération admin mobile.
- Restreindre RLS sur données sensibles.
- Ajouter documentation permissions pour App Store Connect / Google Play Console.
- Clarifier biométrie ou la reporter post-MVP.

## Quick wins

- Ajouter liens légaux sur register/login.
- Remplacer placeholders dans CGU/mentions/privacy.
- Ajouter email support/privacy.
- Transformer l'écran suppression en vraie demande ou vraie suppression.
- Masquer routes admin mobile.

## Points bloquants MVP

- P0 : suppression compte non fonctionnelle.
- P0 : textes légaux non finalisés.
- P0 : consentement CGU/privacy absent à l'inscription.
- P0 : données sensibles exposées via RLS.
- P0 : admin modération mobile encore accessible.
- P1 : wording permissions/biométrie à clarifier.

## Priorisation

### P0

- Finaliser suppression compte.
- Finaliser CGU/privacy/mentions.
- Ajouter consentement à l'inscription.
- Corriger RLS des données sensibles.
- Retirer modération admin mobile.

### P1

- Ajouter contact support/privacy.
- Ajouter raison de refus événement côté créateur.
- Documenter permissions stores.
- Vérifier Android notification permission.

### P2

- Ajouter export données.
- Ajouter blocage/masquage utilisateur si besoin post-MVP.
- Ajouter centre privacy avancé.

## Fichiers concernés

- `app/settings/index.tsx`
- `app/settings/privacy/delete.tsx`
- `app/settings/privacy/policy.tsx`
- `app/settings/legal/cgu.tsx`
- `app/settings/legal/mentions.tsx`
- `src/screens/auth/RegisterScreen.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/services/report.service.ts`
- `src/services/auth.service.ts`
- `app.config.ts`
- `GDPR_MVP_AUDIT.md`
