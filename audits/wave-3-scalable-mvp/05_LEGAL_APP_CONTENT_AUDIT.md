# 05 - Legal Content / App Content Audit

## Résumé exécutif

Les écrans CGU, confidentialité et mentions existent, mais le contenu reste incomplet ou placeholder. Pour une montée en charge, Moments Locaux doit clarifier sa responsabilité, celle des organisateurs, les règles communautaires, les événements privés/publics, les événements impliquant familles/enfants et les raisons de refus.

Niveau actuel : structure présente, contenu légal/éditorial à finaliser.

## Constats

### CGU

- `app/settings/legal/cgu.tsx` contient un texte structuré.
- Plusieurs placeholders restent présents : date, adresse, SIREN, contact.
- Le texte mentionne achats intégrés, monnaie virtuelle, boosts, alors que ces features sont non-MVP.
- Les règles de responsabilité organisateur sont trop générales.

### Politique de confidentialité

- `app/settings/privacy/policy.tsx` est très courte.
- Elle ne détaille pas suffisamment localisation, médias, check-ins, reports, bug reports, notifications, conservation, droits RGPD.

### Règles communautaires

- Pas d'écran dédié identifié.
- Les raisons de signalement existent côté constants.
- Les utilisateurs doivent comprendre ce qui est interdit avant publication/commentaire.

### Politique de modération

- Les statuts `pending/refused` existent.
- La raison de refus doit être visible côté créateur.
- Les raisons de refus devraient être standardisées.

### Responsabilité événement

À clarifier :

- L'organisateur est responsable des informations publiées.
- Moments Locaux héberge/référence et modère.
- Un événement peut changer, être annulé ou être inexact.
- Contact organisateur externe.

### Événements payants/gratuits

- Le store de création contient `price` et `externalLink`.
- Si paiement externe existe, la responsabilité et les règles doivent être claires.
- Si achat in-app absent, éviter wording marketplace.

### Événements privés/publics

- La visibilité privée/unlisted est présente.
- Il faut préciser si un lien privé peut être partagé, qui peut voir l'événement, et les limites de confidentialité.

### Familles/enfants

- L'app cible des événements locaux pouvant concerner familles/enfants.
- CGU doit encadrer âge minimum, autorisation parentale, événements impliquant mineurs, responsabilité organisateur.

## Risques

- Rejet store ou demande de clarification.
- Litige sur responsabilité d'un événement.
- Utilisateurs ne comprenant pas la modération.
- Contenu non-MVP dans CGU créant une promesse excessive.
- Privacy policy insuffisante pour localisation/check-ins.
- Règles privées/publics floues.

## Recommandations

- Finaliser CGU avec juriste.
- Retirer ou conditionner les mentions non-MVP : wallet, boosts, premium, achats intégrés.
- Créer une page "Règles communautaires".
- Créer une page "Politique de modération" courte.
- Ajouter standardisation des raisons de refus.
- Ajouter responsabilité organisateur dans détail/création.
- Ajouter contact légal/support/privacy.
- Ajouter consentement CGU/privacy à l'inscription.

## Quick wins

- Remplacer placeholders CGU.
- Étendre privacy policy aux données réelles traitées.
- Ajouter règles communautaires MVP.
- Ajouter texte clair "l'organisateur est responsable de l'événement".
- Retirer mentions marketplace non-MVP.

## Fichiers concernés

- `app/settings/legal/cgu.tsx`
- `app/settings/legal/mentions.tsx`
- `app/settings/legal/cookies.tsx`
- `app/settings/privacy/policy.tsx`
- `src/screens/auth/RegisterScreen.tsx`
- `app/events/create/preview.tsx`
- `src/screens/profile/MyEventsScreen.tsx`
- `src/constants/report-reasons.ts`

## Scénarios à tester

- Accéder CGU depuis settings.
- Accéder privacy depuis settings.
- Accéder CGU/privacy depuis register.
- Créateur voit règles avant publication.
- Événement refusé avec raison standard.
- Signalement utilise raisons compréhensibles.
- Événement privé expliqué.
- Événement avec lien externe expliqué.

## Priorisation

### P0

- Finaliser CGU/privacy/mentions.
- Ajouter consentement register.
- Clarifier suppression compte et contact privacy.

### P1

- Ajouter règles communautaires.
- Ajouter politique de modération MVP.
- Standardiser raisons de refus.

### P2

- Conditions créateurs avancées.
- Politique marketplace si offres/payments.
- Centre légal complet.
