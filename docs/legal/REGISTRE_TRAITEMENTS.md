# Registre des traitements — Alpha Moments Locaux

Ticket : **SCRUM-207** (epic [SCRUM-200](https://moments-locaux.atlassian.net/browse/SCRUM-200)).
Version alignée : `2026-09-09` (`LEGAL_POLICY_VERSION`).
Responsable de traitement : **Romain Rauyer**, personne physique (pas de SAS / SIRET à ce stade).
Contact : `hello@moments-locaux.com`.

Document **interne**, art. 30 RGPD, proportionné. Ne pas y coller de données utilisateurs ni de secrets. Brouillon produit : validation humaine avant toute communication externe.

Les traitements parkés (check-in, Lumo / IAP, Discovery Engine, Diffuseur B2B, concours) ne sont **pas déployés** en Alpha. Ils restent notés « non déployés » pour éviter de les déclarer comme actifs.

## Sous-traitants et destinataires

| Destinataire | Rôle | Données typiques | Transfert hors UE |
|---|---|---|---|
| Supabase (Supabase Inc.) | Hébergement Auth, Postgres, Storage, Edge Functions | Compte, profil, UGC, logs techniques | Possible (États-Unis / hors UE) — clauses contractuelles types |
| Expo / EAS | Build, updates, notifications push | Tokens push, identifiants techniques d’app | Possible |
| Mapbox | Cartographie | Position approximative / requêtes de tuiles | Possible |
| OpenAI | Sous-traitant IA (processor) | Texte du chat Lumia (historique court) ; image d’affiche pour suggestion ; photo de cover pour génération / édition d’image | Possible (États-Unis) — durée de l’appel API |
| Apple / Google | Stores, notifications, distribution | Compte développeur, métadonnées d’app, questionnaires privacy | Selon le store |

Moments Locaux reste responsable de traitement pour les finalités produit. OpenAI n’entraîne pas de modèles à partir de ces contenus **si** le contrat et le paramétrage API l’excluent (à confirmer à chaque renouvellement de contrat).

## Traitements Alpha actifs

### 1. Compte et authentification

- **Finalité** : créer et sécuriser un compte Particulier, fournir le service.
- **Base légale** : exécution du contrat (CGU) ; intérêt légitime (sécurité, prévention des abus).
- **Données** : e-mail, mot de passe (hash Auth), identifiant, session (SecureStore), éventuellement métadonnées OAuth (Apple / Google).
- **Durée** : tant que le compte est actif ; sessions jusqu’à expiration / déconnexion.
- **Droits** : export JSON (`export-account`) et suppression (`process_account_deletion` + `auth.admin.deleteUser`).

### 2. Profil public et social pairs

- **Finalité** : identification communautaire (nom affiché, avatar, bio, ville, follows).
- **Base légale** : contrat ; intérêt légitime (communauté).
- **Données** : `display_name`, avatar / cover, bio, ville / région, graphe de follows.
- **Visibilité** : publique selon les réglages de profil.

### 3. Découverte d’événements (carte, accueil, recherche)

- **Finalité** : afficher des moments locaux (sources ouvertes + suggestions validées).
- **Base légale** : contrat ; intérêt légitime (référencement de contenus déjà publics).
- **Données** : événements (titre, lieu, dates, médias), interactions (favoris, likes, commentaires, vues).
- **Hors Alpha** : création organisateur (`FEATURE_EVENT_CREATE` parkée).

### 4. Géolocalisation et alertes de proximité

- **Finalité** : carte « autour de moi » et notifications de proximité (permission When In Use + Always).
- **Base légale** : consentement (permission OS) ; contrat pour la personnalisation locale.
- **Données** : position de l’appareil (non stockée comme historique de trajet en Alpha) ; tokens push.
- **Hors Alpha** : check-in GPS / QR.

### 5. UGC : commentaires, photos, suggestions, corrections, signalements

- **Finalité** : conversation autour des moments, contributions communautaires, sécurité.
- **Base légale** : contrat ; obligation légale (modération / DSA pour les signalements).
- **Données** : commentaires, photos (Storage), suggestions d’événements, propositions de correction, `reports`.
- **Modération** : console web (ADR 001), pas d’admin mobile.

### 6. Assistant Lumia (chat)

- **Finalité** : aide in-app et recherche de moments déjà publiés (ADR 009).
- **Base légale** : contrat ; intérêt légitime (assistance) ; information préalable.
- **Données** : texte des questions + court historique **transmis temporairement** à OpenAI ; **pas** de transcription serveur ; compteur `lumia_chat_usage` (user_id, mois, nombre).
- **Export** : historique chat hors périmètre (non persisté serveur). Effacé localement à la déconnexion complète / suppression de compte.

### 7. Suggestion depuis une affiche (vision)

- **Finalité** : préremplir une suggestion d’événement à partir d’une photo d’affiche / flyer.
- **Base légale** : contrat ; consentement éclairé avant envoi (la photo peut contenir des visages, lieux, données identifiantes).
- **Données** : image envoyée à l’Edge `suggest-event-from-poster` puis au sous-traitant IA ; champs extraits (titre, date, lieu) relus par l’utilisateur avant envoi à la modération.
- **Conservation** : l’image peut rester comme visuel de la suggestion si l’utilisateur poursuit le flux ; pas d’entraînement déclaré.

### 7bis. Génération de couverture (image)

- **Finalité** : proposer une cover sobre à partir de la fiche (et, si fournie, de la photo utilisateur).
- **Base légale** : contrat ; information avant envoi (alerte de confirmation).
- **Données** : titre, lieu, catégorie, description, ton choisi ; photo de référence éventuelle envoyée à l’Edge `generate-event-cover` puis à OpenAI (`images/generations` ou `images/edits`).
- **Quota** : 2 générations d’image par brouillon d’événement ; l’utilisateur choisit entre les deux résultats (ou une photo).
- **Conservation** : image générée stockée dans `event-media` si l’utilisateur l’accepte comme cover ; pas d’entraînement déclaré.

### 8. Notifications

- **Finalité** : alertes de proximité, activité sociale, transactional.
- **Base légale** : contrat ; consentement OS pour le push.
- **Données** : `notifications`, tokens Expo.

### 9. Support, contact, bug reports

- **Finalité** : assistance et fiabilité.
- **Base légale** : contrat ; intérêt légitime.
- **Données** : e-mails vers `hello@moments-locaux.com` ; `bug_reports` (page, description).
- **Durée recommandée** : 6–12 mois pour les bug reports.

### 10. Preuve d’acceptation légale

- **Finalité** : tracer l’acceptation CGU / privacy (RGPD / stores).
- **Base légale** : obligation légale / preuve du contrat.
- **Données** : `profiles.legal_accepted_at`, `profiles.legal_policy_version` (SCRUM-203 — colonnes à ajouter, migration non appliquée tant que non validée).
- **Règle** : ne pas réécrire une date existante sans changement de version de politique.

### 11. Logs techniques

- **Finalité** : sécurité, diagnostic, quotas.
- **Base légale** : intérêt légitime.
- **Données** : codes d’erreur, identifiants techniques. Interdit : corps des prompts Lumia / photos en clair dans les logs (ADR 009).

## Traitements non déployés (Alpha)

| Traitement | Statut | Ne pas déclarer comme actif |
|---|---|---|
| Check-in / présence | PARK | Coordonnées de présence, QR |
| Lumo, shop, IAP, missions | PARK | Wallet, achats |
| Discovery Engine | PARK | Scoring / matching avancé |
| Moments Diffuseur / création orga | PARK | Compte organisateur, facturation |
| Concours | PARK | `legal_accepted_at` existe sur `contest_entries` uniquement |

## Mesures de sécurité (résumé)

- Auth Supabase, RLS sur les tables sensibles, tokens en SecureStore.
- Pas de clé service role dans l’app.
- Suppression de compte réelle (Edge + Auth admin).
- Modération UGC via console web.

## Transferts hors UE

Supabase, Mapbox, OpenAI, stores : transferts possibles. Encadrement : DPA / CCT des sous-traitants. À relire à chaque renouvellement.

## Mise à jour

Toute nouvelle finalité Alpha (nouveau SDK, nouvel sous-traitant IA, cookies publicitaires) exige une ligne ici **avant** le copy public et les questionnaires stores (SCRUM-206).
