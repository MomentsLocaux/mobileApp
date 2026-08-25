---
id: guide-onboarding-auth
title: Inscription, connexion et onboarding
category: usage
---

# Compte et onboarding

## Inscription / connexion

- Email + mot de passe via Supabase Auth
- **Connexion sociale (OAuth)** disponible en MVP (Google / Apple selon config du build)

Session persistée entre les ouvertures de l’app.

## Onboarding Particulier (MVP)

Après inscription : parcours **Particulier** uniquement (pas Professionnel / Diffuseur en MVP store-ready).

Étapes typiques : localisation, avatar, thèmes / centres d’intérêt. Pas d’intention « je veux créer des events » ni CTA offres en onboarding MVP.

## Rejouer

Paramètres → Rejouer l’onboarding.

## Suppression

Paramètres → Confidentialité & données → Supprimer mon compte (voir fiche legal).

## Professionnel / Diffuseur (V1, flags off)

`FEATURE_DIFFUSEUR` et parcours pro sont **hors MVP** par défaut. Ne pas orienter l’utilisateur vers ces parcours si le flag est off.

## Lumia et le compte

Lumia ne crée pas de compte, ne change **pas** l’email, ne réinitialise pas de mot de passe, ne supprime pas de compte. Elle indique uniquement les écrans réellement disponibles.

**Changement d’email :** impossible in-app en MVP. Orienter vers hello@moments-locaux.com si besoin.
