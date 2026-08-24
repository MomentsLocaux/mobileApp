---
id: guide-offres
title: Offres Local Habitué Éclaireur
category: offers
---

# Offres et abonnements

Moments Locaux prévoit trois niveaux fonctionnels : **Local**, **Habitué**, **Éclaireur**.

## Important pour Lumia

- **Ne jamais inventer un prix** (montant en euros, promo, essai gratuit…) sauf si une fiche tarifaire validée est ajoutée explicitement à cette base documentaire.
- L’écran **« Nos offres »** n’apparaît que si le flag `FEATURE_OFFERS` est activé dans le build. En MVP store-ready, il est souvent **désactivé**.

Si l’utilisateur demande le prix : orienter vers l’écran Nos offres (si visible) ou indiquer que les tarifs ne sont pas affichés dans cette version, sans chiffre inventé.

## Local (gratuit / base)

Inclus typiquement : carte + fil + recherche, favoris, likes, follow communauté pairs, notifications classiques, signalement, accès CGU / confidentialité.

## Habitué (V1+, souvent payant — sans citer de prix ici)

Ajouts typiques par rapport à Local :
- Check-in sur place (+ Lumo si gamification activée)
- Gagner des Lumo, boutique (boosts & cosmétiques), missions, pass partenaires
- Accès anticipé aux événements, badge Ambassadeur
- Boost créateur via boutique / Lumo

Surfaces visibles seulement si les flags correspondants sont ON (offers, checkin, gamification…).

## Éclaireur (V2 discovery premium — sans citer de prix ici)

Ajouts typiques par rapport à Habitué :
- Idées de moments à rejoindre tout de suite
- Carte de « votre zone » (où vous sortez)
- Recommandations calées sur vos sorties
- Idées hors de vos habitudes
- Résumé de vos découvertes (insights)
- Cadre / badge premium

Nécessite en général `FEATURE_DISCOVERY` et entitlement Éclaireur.

## Ce que Moments Locaux n’est pas

Pas une billetterie : pas de vente de places via l’app ni via Lumia. Un lien externe sur une fiche événement peut exister ; sinon ne pas en inventer.

## Création d’événements et offres

La matrice produit prévoit « créer / soumettre un événement » pour les tiers payants, mais en MVP découverte la **création est flaggée off** : ne pas promettre la publication si le build n’a pas `FEATURE_EVENT_CREATE`.
