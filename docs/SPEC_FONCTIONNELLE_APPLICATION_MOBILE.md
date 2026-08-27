# Spécification fonctionnelle — Application mobile Moments Locaux

| Métadonnée | Valeur |
|---|---|
| **Produit** | Moments Locaux |
| **Document** | Spécification fonctionnelle — application mobile |
| **Version** | 1.1 |
| **Date** | 2026-08-27 |
| **Statut** | Vivant (rétro-ingénierie code + ADRs + MVP_SCOPE) |
| **Sources** | `MVP_SCOPE.md`, ADR 001/002, `src/config/features.ts`, `app/`, `src/services`, audits Wave 1–3, console admin (périmètre complementary) |
| **Périmètre** | MVP store-ready (découverte + social pairs) + modules flaggés (décrits comme hors navigation par défaut) |

> **Amendement 2026-08-27** — Alignement code / `MVP_SCOPE.md` / ADR 002  
> - **MVP visible** = découverte locale + social pairs (auth, onboarding Particulier, carte/liste, favoris, commentaires, Membres, aimé par suivis, invite share, notifs, signalements, compte).  
> - **Supply événements** = scraper OpenAgenda (organisateur « Moments Locaux ») + **console web** de modération ; pas de création mobile obligatoire pour le store.  
> - **Création / check-in / offres / Diffuseur** = V1 derrière flags (`FEATURE_EVENT_CREATE`, `FEATURE_CHECKIN`, etc., défaut **off**).  
> - **Post-auth** → `/(tabs)` (onglet **Accueil** `index`), **pas** la carte.

---

## 1. Objet du document

Cette spécification décrit **ce que fait** l’application mobile Moments Locaux pour ses utilisateurs finaux : personas, parcours, règles métier, écrans et comportements attendus.

Elle ne remplace pas :

- la spécification technique mobile (stack, architecture, API, RLS) — `docs/SPEC_TECHNIQUE_APPLICATION_MOBILE.md` ;
- les spécifications de la console d’administration — *documents D3–D5* ;
- les ADRs produit (`project-management/decisions/`).

---

## 2. Vision produit

**Moments Locaux** est une application mobile de **découverte d’événements locaux** et de **lien entre voisins**. Pour le MVP store-ready, un habitant peut :

1. découvrir ce qui se passe autour de lui (accueil, carte, recherche, filtres, propositions) ;
2. consulter une fiche événement et interagir (favori / like, commentaires / échos, partage) ;
3. suivre d’autres membres (pairs), voir « Aimé par vos suivis », inviter des amis via lien ;
4. signaler un contenu abusif ;
5. gérer son profil, ses notifications et son compte (y compris suppression).

L’**offre d’événements** du MVP vient de l’ingestion OpenAgenda (organisateur Moments Locaux). La **création d’événements**, le **check-in**, les **offres** et le **Diffuseur** existent dans le code mais restent **flaggés off** (phase V1). La **modération opérationnelle** (approuver / refuser / bannir) n’est **pas** dans le mobile : elle est portée par la **console web d’administration** (ADR 001).

---

## 3. Personas

| Persona | Objectif principal | Accès typique |
|---|---|---|
| **Invité** | Parcourir la carte et lire des événements | Sans compte ; actions sociales gated |
| **Participant** (MVP) | Découvrir, s’intéresser, suivre des membres, commenter | Compte authentifié, onboarding Particulier terminé |
| **Créateur / Diffuseur** (V1, flags) | Publier des événements, check-in, offres / packs | Surfaces visibles seulement si `eventCreate` / `checkin` / `offers` / `diffuseur` |
| **Modérateur / Admin** | Rôles backend existants | **Aucune surface de modération** dans le mobile |

---

## 4. Périmètre MVP vs hors MVP

### 4.1 Inclus dans le MVP visible

- Authentification (email/mot de passe, OAuth social, biométrie si session sauvée, reset password)
- Mode invité (carte / lecture limitée)
- Onboarding **Particulier** : localisation, thèmes, avatar (pas d’intent création, pas Professionnel / Diffuseur)
- Découverte : Accueil liste + carte Mapbox + recherche / filtres + recherches sauvées (local) + onglet **Propositions**
- Fiche événement, partage, échos (commentaires / photos communauté) — organisateur affiché Moments Locaux (pas de follow créateur)
- Favoris / like (cœur unifié), intérêt
- **Social pairs** (`FEATURE_SOCIAL_PEERS`, défaut **on**) : drawer Membres, profil `/community/[id]`, « Aimé par vos suivis », invite amis (share sheet)
- Notifications (inbox, push, préférences MVP : nearby, proximité live, rappels, activité sociale pairs, thèmes, budget/quiet)
- Signalement événement / commentaire / média / profil
- Profil, paramètres, bug report, CGU / privacy, suppression de compte

### 4.2 Hors navigation MVP (code présent, gardé / flaggé)

Source de vérité : `src/config/features.ts` (les `*.flags.ts` legacy sont des re-exports).

| Flag | Défaut | Phase | Surfaces |
|---|---|---|---|
| `FEATURE_SOCIAL_PEERS` | **ON** (`=false` pour masquer) | MVP | Membres, follow pairs, aimé par suivis |
| `FEATURE_EVENT_CREATE` | off | V1 | Création, mes events, ModeSwitch, onglet Créer (orga) |
| `FEATURE_CHECKIN` | off | V1 | Check-in QR / géoloc |
| `FEATURE_OFFERS` | off | V1 | Nos offres / Habitué–Éclaireur |
| `FEATURE_DIFFUSEUR` | off | V1 | Onboarding Professionnel / Diffuseur |
| `FEATURE_GAMIFICATION` | off | V2 | Lumo / shop / missions / pass |
| `FEATURE_DISCOVERY` | off | V2 | Discovery Engine |
| `FEATURE_DISCOVERY_CAPTURE` | off | V2 | Capture fond (requiert discovery) |
| `FEATURE_CONTESTS` | off | V2 | Concours |
| `FEATURE_ROADTRIP` | off | Spike | Planificateur roadtrip |
| `FEATURE_LUMIA_CHAT` | off | Post-MVP | Chat assistant Lumia |
| `FEATURE_EVENT_SUGGEST` | off | V1 | Suggestion d’événement depuis une affiche (IA) |

Autres gardes :

| Module | Comportement |
|---|---|
| Analytics créateur / fans hub | Redirect vers tabs / map |
| Modération admin mobile | Redirect vers `/(tabs)/map` |
| Settings avancés (email, sessions, export…) | Redirect vers `/settings` |

**Principe** : masquer l’UI **et** garder les routes ; la sécurité réelle repose sur RLS / backend et sur la console admin.

---

## 5. Architecture fonctionnelle (vue utilisateur)

```
┌─────────────────────────────────────────────────────────┐
│                    Entrée applicative                    │
│  Session ? → Onboarding ? → Tabs (Accueil par défaut)   │
└─────────────────────────────────────────────────────────┘
         │
         ├── Auth (login / register / OAuth / invité)
         ├── Onboarding Particulier (location, thèmes, avatar)
         ├── Découverte (Accueil | Propositions | Carte | Favoris)
         ├── Fiche événement + Échos
         ├── Social pairs (Membres, follow, invite, aimé par suivis)
         ├── Notifications + Préférences
         ├── Signalements + Bug report
         ├── Compte (profil, settings, légal, delete)
         └── [V1 flags] Création / Check-in / Offres / Diffuseur
```

---

## 6. Navigation

### 6.1 Point d’entrée

| État | Destination |
|---|---|
| Chargement session | Splash / loading |
| Non authentifié | `/auth/login` (ou carte en invité) |
| Auth + onboarding incomplet | `/onboarding` |
| Auth + onboarding OK | `/(tabs)` → onglet **Accueil** (`index`) |

### 6.2 Onglets principaux

| Onglet | Route | Auth / garde |
|---|---|---|
| Accueil | `/(tabs)/index` | Requis (GuestGate) — **route initiale** post-auth |
| Propositions | `/(tabs)/proposals` | Requis ; swipe / wizard de propositions autour de l’utilisateur |
| Carte | `/(tabs)/map` | Ouvert invité |
| Créer | CTA centre (sheet contribute / stepper) | Visible **seulement** si `eventCreate` (orga) et/ou `eventSuggest` |
| Favoris | `/(tabs)/favorites` | Requis |
| Profil | Ouvre le **drawer** | Requis pour actions compte |

Quand `eventCreate` et `eventSuggest` sont off, l’onglet Créer est masqué (`href: null`).

### 6.3 Drawer (menu profil)

Sections typiques : Découverte · **Membres** (si `socialPeers`) · Compte (Paramètres, Notifications, Autorisations) · Activité (Favoris ; Mes événements si flags create/suggest) · Assistance (Reporter un bug) · Déconnexion.

Les entrées gamification / Discovery / Concours / Lumia / Roadtrip / Diffuseur n’apparaissent que si le flag correspondant est actif.

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
- Les actions sociales / propositions / favoris / report depuis l’invité ouvrent un **GuestGate** (inscription ou connexion). La création / check-in restent gated et **flaggés V1**.

### 7.2 Onboarding

**Précondition** : utilisateur authentifié, `onboarding_completed = false`.

**MVP (flags Diffuseur / create off)** — parcours Particulier :

1. Bienvenue / identité (**Particulier** uniquement — pas de Professionnel)
2. Localisation (home / zone de référence)
3. Thèmes d’intérêt (taxonomie découverte)
4. Avatar

Pas d’intent « je crée aussi », pas d’étape marketing offres, pas de typologie Diffuseur.

**V1 si flags** : Professionnel (`diffuseur`), intent création Particulier (`eventCreate`), thèmes création, connecteur / offres selon `offers`.

**Post-condition** : `onboarding_completed = true` → `/(tabs)` (Accueil).

### 7.3 Découverte d’événements

#### Accueil (`/(tabs)/index`)

- Feed / liste d’événements autour de l’utilisateur.
- Recherche / accès carte.
- Point d’entrée par défaut après auth + onboarding.

#### Propositions (`/(tabs)/proposals`)

- Wizard de préférences (catégories, rayon, ancre, fenêtre) puis deck swipe de propositions.
- Pool basé sur le viewport / événements publiés (même supply découverte).
- Sessions locales (pause / reprise / historique).

#### Carte (`/(tabs)/map`)

- Carte Mapbox centrée sur la zone utilisateur / viewport.
- Chargement des événements via RPC `list_map_viewport` (bbox) — détail technique D2 / `MAP_SCREEN_ORCHESTRATION.md`.
- Clusters, pin, preview, ouverture fiche.
- Recherche d’adresse / lieu ; recherches récentes / sauvées (local).
- Filtres (catégorie, temporalité, etc. selon UI courante).

#### Fiche événement (`/events/[id]`)

Contenu attendu :

- Cover, titre, dates / planning, lieu, catégorie, description
- Organisateur (**Moments Locaux** en supply scraper — pas de follow créateur / orga)
- Bloc **Aimé par vos suivis** (si `socialPeers` et données disponibles)
- Actions : cœur (like + favori), intérêt, partage, signalement
- Accès aux **Échos** (`/events/echoes`)
- Check-in : seulement si `FEATURE_CHECKIN` (V1)

**Règle de visibilité publique** : seuls les événements `published` (et règles de visibilité `public`) apparaissent en découverte pour le grand public.

### 7.4 Cycle de vie d’un événement (créateur) — **V1 / `eventCreate`**

> **Hors MVP store-ready.** Surfaces actives seulement si `FEATURE_EVENT_CREATE=true` (et/ou `FEATURE_EVENT_SUGGEST` pour la suggestion affiche). Le supply MVP reste le scraper + console.

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
| `published` | Publié | Modérateur (console) | Visible carte/liste/détail ; QR disponible (si check-in V1) |
| `refused` | Refusé | Modérateur | Motif affiché si disponible ; rééditable |
| `archived` | Archivé | Modérateur | Hors découverte active |

**Création** (`/events/create/*`) — flag `eventCreate`

- Stepper multi-étapes (infos, lieu/dates, médias, preview).
- Champs typiques : titre, cover, médias, dates / planning (`ponctuel` | `recurrent` | `permanent`), lieu Mapbox, catégorie / tags, visibilité `public` | `prive`, infos optionnelles (prix, contact…).
- Sauvegarde brouillon possible.
- CTA « Publier » → passage en **`pending`** (pas publication directe).

**Suggestion depuis affiche** (`/events/suggest-from-poster`) — flag `eventSuggest` : préremplissage IA → formulaire create (indépendant de `eventCreate` pour l’entrée contribute).

**Édition** : autorisée uniquement si `draft` ou `refused` (`canEditEvent`).

**Mes événements** (`/profile/my-events`) : accessible si `eventCreate` ou `eventSuggest` ; liste avec badges de statut + temporalité (À venir / En cours / Passé).

### 7.5 Interactions sociales

#### 7.5.1 Social pairs (MVP — `FEATURE_SOCIAL_PEERS`, défaut on)

| Action | Description |
|---|---|
| **Membres** | Drawer → `/(tabs)/community` : recherche + follow d’autres utilisateurs (pas un classement créateurs) |
| Profil membre | `/community/[id]` : follow / unfollow + signalement profil |
| Aimé par vos suivis | Sur fiche événement : likes/favoris des personnes suivies (`list_event_engaged_by_following`) |
| Inviter des amis | Share sheet système + lien app (`/profile/invite`) — **pas** de scan contacts, **pas** de téléphone à l’inscription |

Hors MVP pairs : DMs, demandes d’amis, matching carnet d’adresses, follow organisateur Moments Locaux, rankings créateurs.

#### 7.5.2 Interactions événement (MVP)

| Action | Description |
|---|---|
| Cœur | Bascule like **et** favori (comportement unifié) |
| Intérêt | Marquage d’intérêt dédié |
| Commentaires / échos | Thread + soumission photos communauté |
| Partage | Share sheet événement |

#### 7.5.3 Surfaces créateur (V1 / flags)

| Action | Description |
|---|---|
| Follow créateur / orga | Non pertinent en supply scraper MVP ; ModeSwitch / mes events si `eventCreate` |
| Profil créateur | `/creator/[id]` (public ; hub analytics redirigé hors MVP) |

### 7.6 Check-in — **V1 / `FEATURE_CHECKIN`**

> **Hors MVP store-ready.** Entrées UI masquées si flag off.

**Préconditions** : flag on ; utilisateur authentifié ; événement `published` ; proximité géographique et/ou scan QR valide.

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
| Préférences | `/settings/notifications` — toggles par type, rayon géolocalisé, fréquence, budget / quiet hours |

**Types MVP-core (découverte + pairs)**

- `event_nearby_new`, proximité live, rappels (`event_soon`)
- Activité sociale pairs : `social_follow`, `social_like` (si `socialPeers`)
- Thèmes / préférences contenu
- Compte / trust : `warning_received`, `user_banned`, `system`
- Médias échos : `media_approved`, `media_rejected` (si soumis)

**Types conditionnés flags / V1**

- `followed_creator_published` — affiché dans préférences **seulement si `eventCreate`** (création mobile V1) ; hors MVP scraper (pas de follow orga Moments Locaux)
- `event_published` / `event_refused` / `event_request_changes` — pertinents pour le créateur quand `eventCreate`
- Récompenses / missions — seulement si `gamification`

**Règles**

- Les notifications de modération **ne doivent pas** ouvrir d’écrans admin mobile.
- Le rayon « nearby » s’appuie sur la localisation de référence (onboarding / préférences).
- Consentement / granularité alignés GDPR.
- Pas d’alertes push « nouveaux résultats de recherche » hors MVP.

### 7.9 Profil, paramètres, légal, support

| Fonction | Route / entrée |
|---|---|
| Profil | `/(tabs)/profile` (drawer) |
| Édition profil | `/profile/edit` |
| Paramètres | `/settings` |
| Préférences notifs | `/settings/notifications` |
| Autorisations OS | `/settings/permissions` |
| CGU / privacy / mentions | `/settings` → légal |
| Reporter un bug | `/bug-report` |
| Suppression de compte | `/settings/privacy/delete` → Edge `delete-account` |
| Inviter des amis | `/profile/invite` (si `socialPeers`) |

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

1. **Découverte publique = `published`** (+ visibilité publique) — supply MVP = scraper / console.
2. **Publication créateur ≠ mise en ligne immédiate** (V1 `eventCreate`) : soumission `pending` ; seul un modérateur publie.
3. **Réédition** limitée à `draft` / `refused` (surfaces create).
4. **Invité** : lecture carte OK ; interactions sociales / propositions / favoris gated.
5. **Onboarding Particulier obligatoire** avant l’usage authentifié complet.
6. **Signalements** : écriture user ; lecture / traitement = admin (+ RLS).
7. **UI hiding ≠ sécurité** : RLS et console admin font foi.
8. **Feature flags** : matrice §4.2 — seul `socialPeers` ON par défaut ; create / check-in / offers / diffuseur / gamification / discovery / contests / roadtrip / lumia / eventSuggest **off**.
9. **Compte** : CGU / privacy accessibles ; delete account opérationnel pour stores.
10. **Post-auth** : `/(tabs)` Accueil, pas la carte.

---

## 10. Exigences non fonctionnelles (vue produit)

| Domaine | Attente |
|---|---|
| Plateformes | iOS et Android (Expo) ; schéma `moments-locaux://` |
| Performance perçue | Retour rapide pour utilisateur connu (objectif design < 10 s vers contenu utile) |
| Confidentialité | Consentements localisation / push ; pas d’exposition de clés service role |
| Accessibilité / store | Permissions iOS/Android justifiées ; suppression compte ; politiques légales |
| Observabilité | Remontée d’erreurs (Sentry) sans fuite de secrets |

*(Détail technique : `docs/SPEC_TECHNIQUE_APPLICATION_MOBILE.md`.)*

---

## 11. Matrice de tests d’acceptance (MVP)

Reprise et structuration de la matrice critique produit (`MVP_SCOPE.md`) :

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Créer un compte | Compte + session |
| 2 | Login / logout / OAuth | Session OK / coupée |
| 3 | Onboarding Particulier (location, thèmes, avatar) | Accès `/(tabs)` Accueil — pas d’intent création |
| 4 | Accueil + recherche / liste | Événements visibles |
| 5 | Carte + bbox / filtres | Événements zone cohérents |
| 6 | Ouvrir fiche événement | Contenu complet ; orga Moments Locaux ; pas Suivre orga |
| 7 | Favori / like / commentaire | États persistés |
| 8 | Membres : search, follow, profil pair, report | Flux social pairs OK |
| 9 | Like → « Aimé par vos suivis » pour un follower | Bloc peers visible (RPC appliquée) |
| 10 | Inviter des amis (share) | Sheet système + lien app |
| 11 | Propositions (wizard + swipe) | Pool / décisions locales |
| 12 | Signaler event/comment/média/profil | Report créé |
| 13 | Recevoir / ouvrir notification | Routing correct (non-admin) ; prefs nearby / social pairs |
| 14 | Éditer profil + settings + permissions | Persistance |
| 15 | Suppression de compte | Compte / données traités selon politique |
| 16 | Deep links create / offers avec flags off | Redirect sûr (pas d’écran V1) |

### 11.b Acceptance V1 (flags on — non bloquant store MVP)

| # | Scénario | Flag | Résultat attendu |
|---|---|---|---|
| V1-1 | Créer event + cover + médias | `eventCreate` | Brouillon / données persistées |
| V1-2 | Soumettre publication | `eventCreate` | Statut `pending` dans Mes événements |
| V1-3 | Voir refus + motif | `eventCreate` | Affichage motif |
| V1-4 | Check-in QR ou geo | `checkin` | Succès Edge Function |
| V1-5 | Suggest depuis affiche | `eventSuggest` | Prefill → formulaire |

À valider sur **appareils réels** iOS et Android avant soumission store.

---

## 12. Interactions avec la console d’administration

| Action mobile | Effet | Suite côté console |
|---|---|---|
| *(Supply scraper)* | Events ingest → souvent `pending` | File `/moderation/events` → Approuver / Refuser |
| Soumission événement (V1 `eventCreate`) | `pending` | Idem file events |
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
| **Social pairs** | Follow entre utilisateurs (pas follow organisateur scraper) |
| **Propositions** | Onglet swipe / wizard de découverte personnalisée |
| **Lumo** | Monnaie / gamification (hors MVP navigation) |
| **Discovery** | Moteur de recommandation / mobilité (flaggé V2) |
| **Console admin** | Application web de modération séparée |

---

## 14. Documents liés

| Document | Statut |
|---|---|
| `MVP_SCOPE.md` | Source de vérité scope |
| `src/config/features.ts` | Matrice flags runtime |
| ADR 001 — Admin moderation web app | Accepté |
| ADR 002 — Mobile MVP scope | Accepté (+ amendements OAuth / notifs / discovery-only + peer social) |
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
| 1.1 | 2026-08-27 | Alignement code | MVP découverte + peer social ; flags `features.ts` ; post-auth Accueil ; create/check-in → V1 |
