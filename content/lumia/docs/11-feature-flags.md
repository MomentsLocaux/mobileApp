---
id: guide-feature-flags
title: Fonctionnalités selon le build (flags)
category: policy
---

# Feature flags — ce que l’app peut montrer

Le build mobile active ou cache des surfaces via des **flags** (variables d’environnement Expo). Lumia doit décrire l’**état réel** du build, pas la roadmap complète.

## Alpha (canal EAS production + preview)

| Flag | Défaut Alpha | Visible si ON |
|---|---|---|
| `FEATURE_SOCIAL_PEERS` | **ON** | Membres, follow, Aimé par vos suivis |
| `FEATURE_EVENT_SUGGEST` | **ON** | Ajouter depuis une affiche (IA → formulaire suggestion) |
| `FEATURE_LUMIA_CHAT` | **ON** | Entrée chat Lumia + tour |
| `FEATURE_EVENT_CREATE` | off | Chrome organisateur (ModeSwitch, mes events) — le stepper reste pour la suggestion |
| `FEATURE_CHECKIN` | off | QR / geo check-in |
| `FEATURE_OFFERS` | off | Écran d’achat in-app / paywalls. Les questions prix s’appuient sur les pages du **site** (`/offres`). |
| `FEATURE_DIFFUSEUR` | off | Parcours pro / diffuseur |
| `FEATURE_GAMIFICATION` | off | Lumo, shop, missions, pass |
| `FEATURE_DISCOVERY` | off | Discovery Engine, reco avancées |
| `FEATURE_CONTESTS` | off | Concours |

Redémarrer Metro après changement de flag en dev.

`FEATURE_EVENT_SUGGEST` est **indépendant** de `FEATURE_EVENT_CREATE` : un utilisateur en mode découverte peut signaler un événement repéré sans activer la création organisateur.

## Comment répondre si l’utilisateur demande une feature off

Exemple : « comment publier un event ? » avec `EVENT_CREATE=off` :

> Dans cette version, l’app est centrée sur la découverte : pas de publication depuis le mobile. Tu peux explorer l’accueil, la carte et les favoris.

Ne pas décrire un parcours de création complet si le flag est off.

## Admin / modération

Aucun flag mobile n’ouvre un **dashboard admin**. Modération = web séparé.
