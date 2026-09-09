# Questionnaires stores — Alpha (SCRUM-206)

Brouillon produit à recopier dans App Store Connect (App Privacy) et Google Play Console (Data safety). Source : `docs/legal/REGISTRE_TRAITEMENTS.md`, `app.config.ts`, copy Alpha du 9 septembre 2026.

Store listing : **découverte locale, suggestion depuis une affiche, assistant Lumia**. Pas de création organisateur, pas de check-in, pas d’IAP.

Ne pas appliquer tant que le copy public (SCRUM-201) n’est pas relis.

## SDK et destinataires

| SDK / service | Dans le binaire mobile ? | Données |
|---|---|---|
| Supabase JS | Oui | Compte, profil, UGC |
| Mapbox | Oui | Requêtes de carte / position |
| Expo (notifications, SecureStore, localisation, camera, calendar) | Oui | Tokens, permissions OS |
| OpenAI | Non (Edge Functions) | Texte Lumia, photo d’affiche — déclarer comme données envoyées à un tiers |
| Apple Sign In / Google | Oui si OAuth | Identifiant de compte |

Pas de SDK pub, pas de contacts, pas d’IAP Alpha.

## Apple — App Privacy

**Privacy Policy URL :** `https://www.moments-locaux.com/fr/privacy`

**Tracking :** Non (pas de tracking publicitaire, pas de `AppTrackingTransparency`).

### Données collectées (liées à l’identité)

| Type Apple | Collecté | Lié à l’identité | Tracking | Finalité |
|---|---|---|---|---|
| Contact Info — Email | Oui | Oui | Non | App Function, Account |
| User Content — Photos or Videos | Oui | Oui | Non | App Function (profil, suggestion affiche, contributions) |
| User Content — Other User Content | Oui | Oui | Non | Commentaires, suggestions, signalements |
| Location — Precise | Oui (When In Use + Always proximité) | Oui | Non | App Function (carte, alertes proximité) |
| Identifiers — User ID | Oui | Oui | Non | Account |
| Identifiers — Device ID | Tokens push Expo | Oui | Non | App Function (notifications) |
| Diagnostics | Éventuel via stores / crash OS | Non | Non | App Function / Analytics produit minimal |
| Other Data — Other | Compteur d’usage Lumia (sans texte) | Oui | Non | App Function |
| Purchases | Non | — | — | — |
| Contacts | Non | — | — | — |
| Browsing History | Non | — | — | — |

**Sensitive / health / financial :** Non.

**Data used to track :** Non.

Mentionner dans les notes reviewer : photo d’affiche et chat Lumia sont traités par un **processor IA (OpenAI)** pour le compte de Moments Locaux, sans historique serveur du chat.

## Google — Data safety

**Privacy policy :** même URL.

**App collects user data :** Oui.

| Type Play | Collecté | Partagé | Obligatoire | Finalité |
|---|---|---|---|---|
| Personal info — Email | Oui | Avec Supabase | Oui pour le compte | App functionality, Account management |
| Personal info — Name | Oui (display name) | Non (public profil) | Oui | App functionality |
| Photos and videos | Oui | OpenAI (affiche, temporaire) + Supabase Storage | Non (sauf flux suggestion) | App functionality |
| Location — Approximate / Precise | Oui | Mapbox (tuiles) | Non (permission) | App functionality |
| App activity — In-app search | Lumia / recherche | OpenAI (texte chat) | Non | App functionality |
| App info and performance | Possible | — | — | Analytics |
| Financial / Purchases | Non | — | — | — |
| Contacts | Non | — | — | — |
| Advertising ID | Non | — | — | — |

**Data encrypted in transit :** Oui (HTTPS).

**Users can request deletion :** Oui (in-app + `hello@moments-locaux.com`).

**Independent security review :** Non.

**Committed to Play Families / target age :** 16+ (aligné CGU / privacy).

## Copy store listing (FR, court)

Découvrez ce qui se passe près de chez vous. Suggérez un moment aperçu sur une affiche. Lumia vous aide dans l’app. Moments Locaux n’est pas une billetterie et n’ouvre pas encore la publication organisateur.

## Après validation humaine

1. Appliquer la migration SCRUM-203 si ce n’est pas déjà fait.
2. Remplir les consoles avec ce tableau.
3. Recoller l’âge 16+ et l’URL privacy dans les fiches store.
