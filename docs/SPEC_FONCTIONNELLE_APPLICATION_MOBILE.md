# Spécification fonctionnelle — Application mobile Moments Locaux

| Métadonnée | Valeur |
|---|---|
| **Produit** | Moments Locaux |
| **Document** | Spécification fonctionnelle — application mobile |
| **Version** | 1.0 |
| **Date** | 2026-07-22 |
| **Statut** | Vivant (rétro-ingénierie code + ADRs + MVP_SCOPE) |
| **Sources** | `MVP_SCOPE.md`, ADR 001/002, `app/`, `src/services`, audits Wave 1–3, console admin (périmètre complementary) |
| **Périmètre** | MVP store-ready + modules flaggés (décrits comme hors navigation par défaut) |

---

## 1. Objet du document

Cette spécification décrit **ce que fait** l’application mobile Moments Locaux pour ses utilisateurs finaux : personas, parcours, règles métier, écrans et comportements attendus.

Elle ne remplace pas :

- la spécification technique mobile (stack, architecture, API, RLS) — *document planifié* ;
- les spécifications de la console d’administration — *documents planifiés* ;
- les ADRs produit (`project-management/decisions/`).

---

## 2. Vision produit

**Moments Locaux** est une application mobile de **découverte et de création d’événements locaux**. Elle permet à un habitant ou un créateur de :

1. découvrir ce qui se passe autour de lui (carte, liste, recherche) ;
2. consulter une fiche événement et interagir (favori / intérêt, follow, commentaires / échos) ;
3. créer et soumettre un événement à validation ;
4. s’enregistrer sur place (check-in QR ou géolocalisation) ;
5. signaler un contenu abusif ;
6. gérer son profil, ses notifications et son compte (y compris suppression).

La **modération opérationnelle** (approuver / refuser / bannir) n’est **pas** dans le mobile : elle est portée par la **console web d’administration** (ADR 001).

---

## 3. Personas

| Persona | Objectif principal | Accès typique |
|---|---|---|
| **Invité** | Parcourir la carte et lire des événements | Sans compte ; actions sociales gated |
| **Participant** | Découvrir, s’intéresser, check-in, suivre des créateurs | Compte authentifié, onboarding terminé |
| **Créateur** (particulier / professionnel / institutionnel) | Publier des événements et suivre leur statut éditorial | Même base + « Mes événements » |
| **Modérateur / Admin** | Rôles backend existants | **Aucune surface de modération** dans le mobile |

---

## 4. Périmètre MVP vs hors MVP

### 4.1 Inclus dans le MVP visible

- Authentification (email/mot de passe, OAuth social, biométrie si session sauvée, reset password)
- Mode invité (carte / lecture limitée)
- Onboarding (identité, rôle, localisation, avatar/cover, bio / réseaux)
- Découverte carte (Mapbox) + accueil liste + recherche / filtres
- Fiche événement, partage, échos (commentaires / photos communauté)
- Création multi-étapes + brouillon + soumission
- Statuts créateur : `draft`, `pending`, `published`, `refused`, `archived` + motif de refus
- Favoris / like (cœur unifié), intérêt, follow
- Profils communauté et créateur (public)
- Check-in QR / géoloc
- Notifications (inbox, push, préférences)
- Signalement événement / commentaire / média / profil
- Profil, paramètres, bug report, CGU / privacy, suppression de compte

### 4.2 Hors navigation MVP (code présent, gardé / flaggé)

| Module | Guard typique |
|---|---|
| Boutique, missions, wallet Lumo, pass quartier | `EXPO_PUBLIC_GAMIFICATION_ENABLED` (défaut off) |
| Discovery engine / Moments Locaux+ | `EXPO_PUBLIC_DISCOVERY_ENABLED` |
| Concours | `EXPO_PUBLIC_FEATURE_CONTESTS` |
| Analytics créateur / fans hub | Redirect vers map / profil |
| Modération admin mobile | Redirect vers `/(tabs)/map` |
| Settings avancés (email, sessions, export…) | Redirect vers `/settings` |

**Principe** : masquer l’UI **et** garder les routes ; la sécurité réelle repose sur RLS / backend et sur la console admin.

---

## 5. Architecture fonctionnelle (vue utilisateur)

```
┌─────────────────────────────────────────────────────────┐
│                    Entrée applicative                    │
│  Session ? → Onboarding ? → Tabs (Carte par défaut)     │
└─────────────────────────────────────────────────────────┘
         │
         ├── Auth (login / register / OAuth / invité)
         ├── Onboarding (4 étapes)
         ├── Découverte (Carte | Accueil | Favoris)
         ├── Création événement (stepper → pending)
         ├── Fiche événement + Échos + Check-in
         ├── Social (follow, communauté, profils)
         ├── Notifications + Préférences
         ├── Signalements + Bug report
         └── Compte (profil, settings, légal, delete)
```

---

## 6. Navigation

### 6.1 Point d’entrée

| État | Destination |
|---|---|
| Chargement session | Splash / loading |
| Non authentifié | `/auth/login` (ou carte en invité) |
| Auth + onboarding incomplet | `/onboarding` |
| Auth + onboarding OK | `/(tabs)/map` |

### 6.2 Onglets principaux

| Onglet | Route | Auth |
|---|---|---|
| Accueil | `/(tabs)/index` | Requis (GuestGate) |
| Carte | `/(tabs)/map` | Ouvert invité |
| Créer | CTA → `/events/create/step-1` | Requis |
| Favoris | `/(tabs)/favorites` | Requis |
| Profil | Ouvre le **drawer** | Requis pour actions compte |

### 6.3 Drawer (menu profil)

Sections typiques : Découverte / Création / Mon profil / Communauté · Compte (Paramètres, Notifications) · Activité (Favoris, Mes événements…) · Assistance (Reporter un bug) · Déconnexion.

Les entrées gamification / Discovery / Concours n’apparaissent que si le flag correspondant est actif.

---

## 7. Parcours fonctionnels détaillés

### 7.1 Authentification & session

**Objectif** : créer une session durable et sécurisée.

| Fonction | Description |
|---|---|
| Inscription | Email + mot de passe → compte Supabase Auth + profil |
| Connexion | Email + mot de passe |
| OAuth | Fournisseurs sociaux (ex. Facebook, Apple) via deep link `/auth/callback` |
| Mot de passe oublié | Demande + écran reset |
| Biométrie | Déverrouillage si credentials locaux présents |
| Continuer en invité | Accès carte / lecture sans compte |
| Déconnexion | Fin de session |
| Oublier cet appareil | Nettoyage local des credentials |

**Règles**

- Une session expirée renvoie vers login.
- Les actions sociales / création / check-in / report depuis l’invité ouvrent un **GuestGate** (inscription ou connexion).

### 7.2 Onboarding

**Précondition** : utilisateur authentifié, `onboarding_completed = false`.

Étapes attendues :

1. Identité + **rôle** : `particulier` | `professionnel` | `institutionnel`
2. Localisation (home / zone de référence)
3. Avatar et cover
4. Bio et liens sociaux

**Post-condition** : `onboarding_completed = true` → accès aux tabs.

### 7.3 Découverte d’événements

#### Carte (`/(tabs)/map`)

- Carte Mapbox centrée sur la zone utilisateur / viewport.
- Chargement des événements de la zone visible (bbox).
- Clusters, pin, preview, ouverture fiche.
- Recherche d’adresse / lieu.
- Filtres (catégorie, temporalité, etc. selon UI courante).

#### Accueil (`/(tabs)/index`)

- Feed / liste d’événements.
- Recherche textuelle.
- Éléments sociaux (ex. stories créateurs) selon implémentation courante.

#### Fiche événement (`/events/[id]`)

Contenu attendu :

- Cover, titre, dates / planning, lieu, catégorie, description
- Créateur (lien profil)
- Statut de publication (si pertinent pour le créateur)
- Actions : cœur (like + favori), intérêt, follow, partage, signalement
- Check-in (si événement publié et conditions remplies)
- Accès aux **Échos** (`/events/echoes`)

**Règle de visibilité publique** : seuls les événements `published` (et règles de visibilité `public`) apparaissent en découverte pour le grand public.

### 7.4 Cycle de vie d’un événement (créateur)

```
draft ──soumission──► pending ──(console admin)──► published
                         │
                         └──► refused ──réédition──► draft/pending
published ──(admin)──► archived
```

| Statut | Label UX | Qui agit | Comportement mobile |
|---|---|---|---|
| `draft` | Brouillon | Créateur | Éditable ; non visible en découverte |
| `pending` | En validation | Créateur (soumission) | Visible dans « Mes événements » ; pas en découverte publique |
| `published` | Publié | Modérateur (console) | Visible carte/liste/détail ; QR disponible |
| `refused` | Refusé | Modérateur | Motif affiché si disponible ; rééditable |
| `archived` | Archivé | Modérateur | Hors découverte active |

**Création** (`/events/create/*`)

- Stepper multi-étapes (infos, lieu/dates, médias, preview).
- Champs typiques : titre, cover, médias, dates / planning (`ponctuel` | `recurrent` | `permanent`), lieu Mapbox, catégorie / tags, visibilité `public` | `prive`, infos optionnelles (prix, contact…).
- Sauvegarde brouillon possible.
- CTA « Publier » → passage en **`pending`** (pas publication directe).

**Édition** : autorisée uniquement si `draft` ou `refused` (`canEditEvent`).

**Mes événements** (`/profile/my-events`) : liste avec badges de statut + temporalité (À venir / En cours / Passé).

### 7.5 Interactions sociales

| Action | Description |
|---|---|
| Cœur | Bascule like **et** favori (comportement unifié) |
| Intérêt | Marquage d’intérêt dédié |
| Follow / unfollow | Suivre un créateur ou membre |
| Communauté | Liste / leaderboard membres (si exposé) |
| Profil membre | `/community/[id]` |
| Profil créateur | `/creator/[id]` (public ; hub analytics redirigé hors MVP) |

### 7.6 Check-in

**Préconditions** : utilisateur authentifié ; événement `published` ; proximité géographique et/ou scan QR valide.

**Modes**

1. Scan QR (caméra)
2. Check-in géolocalisé (distance)

**Backend fonctionnel** : Edge Function `event-checkin`.

**Règles associées**

- Le QR événement est généré à la publication (côté admin / backend).
- Partage du QR restreint au propriétaire / rôles privilégiés.
- Les photos « échos » communauté sont souvent conditionnées au check-in (sauf owner / admin).

### 7.7 Signalements (trust & safety côté utilisateur)

L’utilisateur authentifié peut signaler :

| Cible | Exemples de motifs |
|---|---|
| Événement | Spam, inapproprié, harcèlement, fausse info, dangereux, autre |
| Commentaire | idem |
| Média | idem |
| Profil / utilisateur | idem |

**Règles**

- Création d’un enregistrement `reports` (insert utilisateur).
- Pas de file de traitement dans le mobile : le suivi est fait dans la **console admin**.
- Pas d’action de modération (approve / ban) côté mobile.

### 7.8 Notifications

| Canal | Fonction |
|---|---|
| Inbox | `/notifications` — liste, lu / non lu, navigation contextuelle |
| Push | Enregistrement device + livraison (Expo / FCM via `push-dispatch`) |
| Préférences | `/settings/notifications` — toggles par type, rayon géolocalisé, fréquence |

**Types MVP-core (exemples)**

- `event_published`, `event_soon`, `event_nearby_new`
- `followed_creator_published`
- `social_follow`, `social_like`
- `event_refused`, `event_request_changes`
- `warning_received`, `user_banned`
- `media_approved`, `media_rejected`
- `system`

**Règles**

- Les notifications de modération **ne doivent pas** ouvrir d’écrans admin mobile.
- Le rayon « nearby » s’appuie sur la localisation de référence (onboarding / préférences).
- Consentement / granularité alignés GDPR.

### 7.9 Profil, paramètres, légal, support

| Fonction | Route / entrée |
|---|---|
| Profil | `/(tabs)/profile` |
| Édition profil | `/profile/edit` |
| Paramètres | `/settings` |
| Préférences notifs | `/settings/notifications` |
| CGU / privacy / mentions | `/settings` → légal |
| Reporter un bug | `/bug-report` |
| Suppression de compte | `/settings/privacy/delete` → Edge `delete-account` |

La suppression de compte est un prérequis **store-ready** (Apple / Google).

---

## 8. Modèle de données fonctionnel (vue métier)

### 8.1 Profil utilisateur

| Attribut | Valeurs / notes |
|---|---|
| Rôle produit | `invite` \| `particulier` \| `professionnel` \| `institutionnel` |
| Rôle ops (backend) | `moderateur` \| `admin` (sans UI mobile dédiée) |
| Statut compte | `active` \| `restricted` \| `suspended` \| `banned` |
| Onboarding | `onboarding_completed` |

### 8.2 Événement

| Attribut | Valeurs |
|---|---|
| Statut éditorial | `draft` \| `pending` \| `published` \| `refused` \| `archived` |
| Visibilité | `public` \| `prive` |
| Planning | `ponctuel` \| `recurrent` \| `permanent` |
| Motif de refus | Affiché au créateur si fourni |

### 8.3 Médias « échos »

Statuts de soumission : `pending` \| `approved` \| `rejected` (validation côté console / backend).

### 8.4 Catégories MVP (slugs)

`arts-culture`, `marches-artisanat`, `fetes-animations`, `famille-enfants`, `gastronomie-saveurs`, `nature-bienetre`, `ateliers-apprentissage`, `sport-loisirs`, `vie-locale`, `insolite-ephemere`

---

## 9. Règles métier transverses

1. **Publication ≠ mise en ligne immédiate** : le créateur soumet (`pending`) ; seul un modérateur publie (`published`).
2. **Découverte publique = `published`** (+ visibilité publique).
3. **Réédition** limitée à `draft` / `refused`.
4. **Invité** : lecture carte OK ; création et interactions sociales gated.
5. **Onboarding obligatoire** avant l’usage authentifié complet.
6. **Signalements** : écriture user ; lecture / traitement = admin (+ RLS).
7. **UI hiding ≠ sécurité** : RLS et console admin font foi.
8. **Feature flags** : Discovery / Concours / Gamification **off** par défaut en MVP.
9. **Compte** : CGU / privacy accessibles ; delete account opérationnel pour stores.

---

## 10. Exigences non fonctionnelles (vue produit)

| Domaine | Attente |
|---|---|
| Plateformes | iOS et Android (Expo) ; schéma `momentslocaux://` |
| Performance perçue | Retour rapide pour utilisateur connu (objectif design < 10 s vers contenu utile) |
| Confidentialité | Consentements localisation / push ; pas d’exposition de clés service role |
| Accessibilité / store | Permissions iOS/Android justifiées ; suppression compte ; politiques légales |
| Observabilité | Remontée d’erreurs (Sentry) sans fuite de secrets |

*(Détail technique : spécification technique mobile planifiée.)*

---

## 11. Matrice de tests d’acceptance (MVP)

Reprise et structuration de la matrice critique produit :

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Créer un compte | Compte + session |
| 2 | Login / logout | Session OK / coupée |
| 3 | Onboarding complet | Accès tabs |
| 4 | Recherche adresse + carte | Événements zone visibles |
| 5 | Filtres / recherche events | Résultats cohérents |
| 6 | Ouvrir fiche événement | Contenu complet |
| 7 | Créer event + cover + médias | Brouillon / données persistées |
| 8 | Soumettre publication | Statut `pending` dans Mes événements |
| 9 | Voir refus + motif | Affichage motif |
| 10 | Event publié visible map/liste | Après action admin |
| 11 | Favori / like / follow | États persistés |
| 12 | Check-in QR ou geo | Succès Edge Function |
| 13 | Signaler event/comment/média/profil | Report créé |
| 14 | Recevoir / ouvrir notification | Routing correct (non-admin) |
| 15 | Éditer profil + settings | Persistance |
| 16 | Suppression de compte | Compte / données traités selon politique |

À valider sur **appareils réels** iOS et Android avant soumission store.

---

## 12. Interactions avec la console d’administration

| Action mobile | Effet | Suite côté console |
|---|---|---|
| Soumission événement | `pending` | File `/moderation/events` → Approuver / Refuser |
| Signalement | `reports` | `/moderation/reports` (+ commentaires / users) |
| Photo écho | soumission `pending` | `/moderation/media` |
| Bug report | `bug_reports` | `/moderation/bugs` |
| Compte sanctionné | statut profil | `/moderation/users` (ban / lift) |

Le mobile affiche les **conséquences** (refus, warning, ban, média rejeté) via statuts et notifications, sans exposer les outils de traitement.

---

## 13. Glossaire

| Terme | Définition |
|---|---|
| **Écho** | Contenu communautaire (commentaire / photo) lié à un événement |
| **Pending** | En attente de validation éditoriale |
| **GuestGate** | Modale forçant inscription/connexion avant une action protégée |
| **Lumo** | Monnaie / gamification (hors MVP navigation) |
| **Discovery** | Moteur de recommandation / mobilité (flaggé) |
| **Console admin** | Application web de modération séparée |

---

## 14. Documents liés

| Document | Statut |
|---|---|
| `MVP_SCOPE.md` | Source de vérité scope |
| ADR 001 — Admin moderation web app | Accepté |
| ADR 002 — Mobile MVP scope | Accepté (+ amendement notifs / OAuth) |
| `docs/PLAN_DOCUMENTATION_PRODUIT.md` | Plan des specs restantes |
| Spécification technique application mobile | Livré — `docs/SPEC_TECHNIQUE_APPLICATION_MOBILE.md` |
| Spécification fonctionnelle Console d’administration | Livré — `Moderation-WebConsole/docs/SPEC_FONCTIONNELLE_CONSOLE_ADMIN.md` |
| Spécification technique Console d’administration | Livré — `Moderation-WebConsole/docs/SPEC_TECHNIQUE_CONSOLE_ADMIN.md` |
| User Guide Console d’administration | Livré — `Moderation-WebConsole/docs/USER_GUIDE_CONSOLE_ADMIN.md` |

---

## 15. Historique

| Version | Date | Auteur | Notes |
|---|---|---|---|
| 1.0 | 2026-07-22 | Rétro-ingénierie agentique | Première version consolidée code + docs |
