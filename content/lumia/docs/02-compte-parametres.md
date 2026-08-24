---
id: guide-compte-parametres
title: Compte, profil et paramètres
category: usage
---

# Compte et paramètres

## Profil

Menu profil (bas droite) → voir son profil public.

**Modifier le profil** : Paramètres → Modifier le profil (nom, photo, bio, etc.).

## Paramètres (menu profil → Paramètres)

Sections principales :

- **Compte** — modifier le profil, rejouer l’onboarding.
- **Notifications** — Gérer les notifications (fréquence, thèmes, proximité, activité sociale…).
- **Autorisations** — Gérer les autorisations de l’application (localisation, notifications push, etc.).
- **Confidentialité & données** — politique de confidentialité, suppression de compte.
- **Informations légales** — CGU, mentions légales, politique des cookies.

## Connexion / déconnexion

Connexion et déconnexion via le menu profil (session Supabase Auth).

## Onboarding

Première ouverture : parcours Particulier (localisation, avatar, thèmes). Pas de parcours Professionnel en MVP store-ready.

**Rejouer l’onboarding** : Paramètres → Rejouer l’onboarding.

## Création de moments (V1, flag off par défaut)

Si `FEATURE_EVENT_CREATE` est activé dans le build :
- Paramètres → Activer la création de moments (compte Particulier requis).
- Switch Découvreur / Créateur sur le profil pour publier.

Si le flag est **désactivé** (MVP découverte) : pas de bouton + central, pas de publication — uniquement explorer accueil, carte, favoris.

## Compte invité

Certaines actions (ex. activer la création) sont réservées à un compte Particulier complet, pas au mode invité.
