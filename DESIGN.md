# Moments Locaux - Design System

Based on "Super Fan Insights" Stitch Project & `mobileApp-Bolt` standards.

## 1. Core Identity

- **Name**: Moments Locaux
- **Theme**: Lifestyle / Modern / Socials
- **Mode**: Dark Mode First (as seen in Stitch screens)
- **Primary Font**: Plus Jakarta Sans
- **Rounding**: Token-based (8 / 16 / 24 / pill)

## 2. Color Palette

### Primary Colors
- **Brand Primary**: `#0f1719`
- **Brand Secondary**: `#2bbfe3`

### Backgrounds (Dark Mode)
- **Background Dark**: `#0f1719`
- **Surface Dark**: `#1a2426`

### Text Colors
- **Text Primary**: `#ffffff`
- **Text Secondary**: `#94a3b8`

### Functional Colors
- **Success**: `#10b981`
- **Error**: `#ef4444`
- **Warning**: `#f59e0b`

## 3. Typography

**Family**: `Plus Jakarta Sans`

| Style | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | 32px | 700 (Bold) | 38px | Hero titles |
| **H1** | 24px | 700 (Bold) | 30px | Main section titles |
| **Body** | 16px | 400 (Regular) | 24px | Standard text |
| **Caption** | 12px | 400 (Regular) | 16px | Secondary info |

Weight scale:
- **Bold**: `700`
- **Medium**: `500`
- **Regular**: `400`

## 4. Components

### Buttons
- **Primary**: Full width, 56px height, radius `999`, text `#ffffff`, background `#2bbfe3`.
- **Secondary**: Transparent background with border `1px` in `#94a3b8`.
- **Ghost**: Text only, usually for "Skip" or "Cancel".

### Cards
- **Background**: Surface Dark (`#1a2426`).
- **Border Radius**: `16px` (default), `24px` (highlighted cards).
- **Shadow (Elevation 1)**: `x: 0, y: 4, blur: 20, opacity: 0.05, color: #000`.

### Inputs
- **Background**: Surface Dark (`#1a2426`).
- **Border**: Thin, `#94a3b8`.
- **Text**: `#ffffff`.
- **Placeholder**: `#94a3b8`.

## 5. Spacing System

Base unit: `8px`

- **xs**: 8px
- **sm**: 16px
- **md**: 24px (Standard section spacing)
- **lg**: 32px
- **xl**: 48px
- **xxl**: 64px

## 6. Radius & Shadows

### Border Radius Tokens
- **small**: `8`
- **medium**: `16`
- **large**: `24`
- **pill**: `999`

### Shadow Tokens
- **elevation1**:
1. offset x: `0`
2. offset y: `4`
3. blur: `20`
4. opacity: `0.05`
5. color: `#000`

## 7. Icons
- **Library**: Ionicons (via `@expo/vector-icons`).
- **Style**: Filled for active states, Outline for inactive.

## 8. UX/UI Spec - Acces et cycle d'entree

Perimetre ecrans:
- `app/index.tsx` (routeur d'entree)
- `app/auth/login.tsx`
- `app/auth/register.tsx`
- `app/onboarding.tsx`
- `app/+not-found.tsx`

### 8.1 Objectifs UX
- Permettre une entree en moins de 10 secondes pour un utilisateur connu.
- Reduire la friction d'inscription (validation claire, erreurs explicites).
- Garantir une completion onboarding guidee avant acces complet a l'app.
- Offrir un mode invite sans bloquer la decouverte.

### 8.2 Flux global (decision)
1. Ouverture app -> `app/index.tsx`
2. Si session en chargement -> etat "Loading" plein ecran.
3. Si non authentifie -> redirection `app/auth/login.tsx`
4. Si authentifie + onboarding non complete -> redirection `app/onboarding.tsx`
5. Sinon -> redirection `app/(tabs)/map.tsx`

### 8.3 Spec par ecran

#### A. `app/index.tsx` (Splash logique)
But UX:
- Eviter tout ecran intermediaire inutile.
- Donner une perception de rapidite et de continuite.

UI attendue:
- Ecran neutre plein ecran avec loader centré.
- Aucun CTA visible.

Etats:
- `loading`: spinner visible.
- `notAuthenticated`: redirect auto vers login.
- `authenticated + onboarding=false`: redirect auto vers onboarding.
- `authenticated + onboarding=true`: redirect auto vers map.

Regles:
- Pas d'interaction utilisateur.
- Temps de chargement cible percu: < 1.5s (si possible).

#### B. `app/auth/login.tsx`
But UX:
- Prioriser la reconnexion rapide (biometrie si session sauvegardee).
- Proposer une alternative invite immediate.

Structure UI:
- Hero visuel plein ecran (image + gradient sombre).
- Bloc marque: logo, nom app, baseline.
- Formulaire progressif:
1. Etat initial: bouton principal unique.
2. Etat formulaire: email + mot de passe + CTA connexion.
- Actions secondaires:
1. "Utiliser un mot de passe" (si biometrie disponible).
2. "Continuer en invite".
3. Lien "Creer un compte".

Etats UX:
- `default`: CTA contextualise selon session sauvegardee.
- `showForm=true`: champs visibles.
- `isLoading || biometricLoading`: CTA desactive + libelle chargement.
- `error`: alerte explicite (credentials invalides).

Regles de validation:
- Email requis et format valide.
- Mot de passe requis, min 6 caracteres.
- Affichage d'erreur inline par champ + erreur globale en alerte.

Microcopy recommandee:
- CTA principal:
1. "Connexion biometrique" si session sauvegardee.
2. "Se connecter avec un email" sinon.
- Fallback humain: "Utiliser un mot de passe".

Accessibility:
- Contraste texte/blocs >= WCAG AA.
- Ordre de focus: email -> mot de passe -> CTA principal -> actions secondaires.
- Taille touch target min 44x44.

#### C. `app/auth/register.tsx`
But UX:
- Creation de compte simple en un seul ecran.
- Gerer explicitement le cas "verification email requise".

Structure UI:
- Header simple (retour, titre, sous-titre).
- Formulaire 3 champs:
1. Email
2. Mot de passe
3. Confirmation mot de passe
- CTA principal: "S'inscrire"
- Lien de bascule: "Se connecter"

Etats UX:
- `idle`: edition libre.
- `loading`: CTA avec loader.
- `validation error`: messages inline.
- `requiresEmailConfirmation`: alerte + redirection login.
- `success`: confirmation puis redirection vers tabs.

Regles de validation:
- Email requis + format valide.
- Mot de passe requis, min 6 caracteres.
- Confirmation identique au mot de passe.

Feedback:
- Erreurs metier en langage utilisateur (pas de jargon technique).
- Confirmation d'action explicite apres inscription.

#### D. `app/onboarding.tsx`
But UX:
- Collecter les donnees minimales utiles sans surcharge cognitive.
- Garder une progression claire et reversible.

Architecture du flow:
- Wizard en 4 etapes avec barre de progression.
1. Identite: nom d'affichage + role.
2. Localisation: recherche adresse et selection.
3. Visuels: avatar + cover (optionnels mais encourages).
4. Reseaux & bio.

Elements UI globaux:
- Header avec bouton retour + progression "Etape X / 4".
- Barre de progression segmentee.
- Corps de page centré sur l'etape active.
- Navigation bas de page: precedent / continuer / terminer.

Regles UX:
- Bouton "Continuer" actif seulement si prerequis de l'etape sont remplis.
- Sauvegarde finale atomique lors de "Terminer".
- En cas d'erreur reseau: message clair + retry.
- Redirection finale vers `/(tabs)` apres succes.

Prerequis par etape:
1. Etape 1: nom d'affichage non vide.
2. Etape 2: adresse selectionnee.
3. Etape 3: aucune obligation bloquante.
4. Etape 4: aucune obligation bloquante.

Qualite de saisie:
- Auto-scroll sur focus input.
- Champs reseaux en format libre (handle ou URL).
- Limiter le texte aux contraintes metier (ex: display name max 50).

Accessibility:
- Progression lisible par lecteur d'ecran ("Etape 2 sur 4").
- Labels explicites pour chaque champ.
- Etats selection (role, adresse) perceptibles sans couleur seule.

#### E. `app/+not-found.tsx`
But UX:
- Recuperer rapidement l'utilisateur d'une route invalide.

UI attendue:
- Message court comprehensible.
- CTA unique de retour accueil (`/`).

Recommandation copy FR:
- Titre: "Oups, cette page n'existe pas"
- CTA: "Revenir a l'accueil"

### 8.4 Etats transverses a couvrir
- Perte reseau pendant auth/onboarding.
- Session expiree pendant onboarding -> retour login avec message.
- Erreurs API normalisees (affichage utilisateur coherent).
- Eviter double soumission sur tous les CTA asynchrones.

### 8.5 Critieres d'acceptation UX/UI
- L'utilisateur non connecte atteint login sans flash d'ecran parasite.
- Un utilisateur avec session sauvegardee peut tenter la biometrie en 1 tap.
- Le mode invite est accessible depuis login en 1 tap.
- L'inscription affiche une erreur de validation par champ.
- Onboarding ne permet pas d'avancer si prerequis etape non satisfaits.
- La completion onboarding redirige vers les tabs sans boucle.
- Une route inconnue propose toujours un retour accueil fonctionnel.

## 9. UX/UI Spec - Navigation principale (Tabs)

Perimetre ecrans:
- `app/(tabs)/index.tsx` -> Accueil
- `app/(tabs)/map.tsx` -> Carte interactive
- `app/(tabs)/create.tsx` -> Entree rapide creation
- `app/(tabs)/community.tsx` -> Communaute
- `app/(tabs)/profile.tsx` -> Profil utilisateur
- `app/(tabs)/shop.tsx` -> Boutique
- `app/(tabs)/favorites.tsx` -> Favoris
- `app/(tabs)/missions.tsx` -> Missions

### 9.1 Objectifs UX
- Offrir une navigation persistante, lisible et immediate en bas d'ecran.
- Permettre l'acces en 1 tap aux 5 usages coeur (accueil, carte, creation, communaute, profil).
- Garder les destinations secondaires (shop, favoris, missions) accessibles sans surcharger la tab bar.
- Preserver le contexte utilisateur pendant le changement d'onglet (pas de perte d'etat non voulue).

### 9.2 Structure de navigation
- Tab bar visible et persistante sur la navigation principale.
- Onglets visibles en barre:
1. Accueil (`index`)
2. Carte (`map`)
3. Creation (`create`, bouton central)
4. Communaute (`community`)
5. Profil (`profile`)
- Onglets secondaires masques de la barre mais routables:
1. Boutique (`shop`)
2. Favoris (`favorites`)
3. Missions (`missions`)

### 9.3 Comportement global de la tab bar

Composants UI:
- Fond clair/surface, separation haute discrere, icones sans labels visibles.
- Bouton central de creation plus proeminent (forme ronde, couleur de marque).
- Badge notifications sur l'icone Profil si non-lu.

Regles d'interaction:
- 1 tap sur un onglet visible -> navigation immediate.
- 2e tap sur l'onglet courant -> optionnel: retour top de liste (si ecran scrollable).
- Onglets proteges en mode invite (`index`, `community`, `profile`, `create`) -> ouverture gate auth.
- `map` reste accessible en invite.

Etats:
- `active`: icone teinte active.
- `inactive`: icone teinte neutre.
- `disabled guest`: icone attenuee + action remplacee par modal d'authentification.
- `has notifications`: badge numerique cappe (ex: `99+`).

Accessibility:
- Cible tactile minimum 44x44.
- Label d'accessibilite explicite par onglet ("Aller a la carte", etc.).
- Etat actif expose aux lecteurs d'ecran.

### 9.4 Spec par ecran de tab

#### A. `app/(tabs)/index.tsx` (Accueil)
Role fonctionnel:
- Flux editorial principal, decouverte, mise en avant de contenus.

Objectifs UX:
- Donner une vision immediate de "quoi faire maintenant".
- Mettre en avant les contenus prioritaires (proximite, tendance, recents).

UI attendue:
- Header simple (salutation, recherche rapide optionnelle).
- Liste de sections scannables (cards, carrousels, CTA contextuels).
- Etat vide exploitable (suggestions, categories, CTA explorer).

Etats:
- loading skeleton
- success avec contenu
- empty state guide
- error state avec retry

#### B. `app/(tabs)/map.tsx` (Carte interactive)
Role fonctionnel:
- Point d'entree geospatial pour explorer les evenements.

Objectifs UX:
- Voir rapidement les evenements autour de soi.
- Basculer sans friction entre vue carte et details.

UI attendue:
- Carte plein ecran.
- Couches UI flottantes: recherche, filtres, apercu rapide.
- Marker actif visuellement distinct.

Etats:
- permission localisation demandee/refusee/accordee
- chargement markers
- aucun resultat dans zone
- erreur recuperation donnees carte

Regles:
- Un tap marker ouvre un preview, 2e action ouvre le detail complet.
- Les filtres appliques doivent etre persistants a court terme (session locale).

#### C. `app/(tabs)/create.tsx` (Entree rapide creation)
Role fonctionnel:
- Action primaire de contribution (creer un evenement).

Objectifs UX:
- Rendre l'intention de creation immediate depuis n'importe ou.

UI attendue:
- Bouton central sur-eleve dans la tab bar.
- Navigation directe vers `events/create/step-1`.

Regles:
- Si invite: gate auth avec choix connexion/inscription.
- Si connecte: ouverture instantanee du flow creation.

#### D. `app/(tabs)/community.tsx` (Communaute)
Role fonctionnel:
- Explorer profils, interactions sociales et dynamiques communautaires.

Objectifs UX:
- Favoriser la decouverte de membres et de reseaux proches.

UI attendue:
- Liste/cartes profils avec criteres de tri/filtre.
- Entrees rapides vers profil communautaire detaille.

Etats:
- loading
- resultats
- empty (aucun membre trouve)
- error + retry

Regles:
- Invite -> gate auth avant interaction profonde.
- Conservation des filtres lors du retour depuis un profil detail.

#### E. `app/(tabs)/profile.tsx` (Profil utilisateur)
Role fonctionnel:
- Hub personnel: informations compte, raccourcis, actions privees.

Objectifs UX:
- Donner acces a toutes les actions perso en un point central.

UI attendue:
- Entete identite (avatar, nom, metadonnees).
- Acces aux sections: parametres, notifications, invites, parcours, etc.
- Badge notifications coherent avec tab bar.

Regles:
- Invite -> gate auth.
- Les actions de navigation interne doivent conserver le retour contexte profil.

#### F. `app/(tabs)/shop.tsx` (Boutique)
Role fonctionnel:
- Consultation d'offres, abonnements, upsell.

Objectifs UX:
- Presenter clairement la proposition de valeur premium.

UI attendue:
- Plans/offres en cards comparables.
- CTA clair par plan.
- Mention explicite prix/periode.

Contrainte navigation:
- Ecran routable mais masque de la tab bar principale.
- Accessible via menu profil / liens contextuels.

#### G. `app/(tabs)/favorites.tsx` (Favoris)
Role fonctionnel:
- Retrouver rapidement les contenus sauvegardes.

Objectifs UX:
- Eviter la perte de contenus "a revoir".

UI attendue:
- Liste favoris avec meta utiles (date, lieu, categorie).
- Actions rapides: ouvrir, retirer des favoris.

Contrainte navigation:
- Ecran routable mais masque de la tab bar principale.
- Accessible via menu profil / actions coeur.

#### H. `app/(tabs)/missions.tsx` (Missions)
Role fonctionnel:
- Parcours engagement/gamification (objectifs, progression, recompenses).

Objectifs UX:
- Rendre la progression motivante et lisible.

UI attendue:
- Liste missions par statut (a faire, en cours, terminees).
- Barre/progression numerique.
- CTA actionnable par mission.

Contrainte navigation:
- Ecran routable mais masque de la tab bar principale.
- Accessible via menu profil / CTA dedies.

### 9.5 Etats transverses de la navigation tabs
- Reconnexion automatique si session restauree en arriere-plan.
- Sync badge notifications en temps reel (ou polling degrade).
- Fallback hors-ligne: conserver le dernier etat connu lorsque pertinent.
- Eviter les transitions lourdes entre tabs (perception de fluidite > 50 fps cible).

### 9.6 Critieres d'acceptation UX/UI
- La tab bar reste visible sur tous les ecrans de niveau tabs.
- Le bouton `create` est identifiable comme action primaire sans ambiguite.
- En mode invite, les tabs protegees ouvrent un gate auth coherent.
- `map` est utilisable sans authentification.
- `shop`, `favorites`, `missions` sont accessibles via navigation secondaire, sans apparaitre dans la barre.
- Le badge notifications apparait sur l'entree profil et se met a jour correctement.
- Le changement d'onglet conserve l'etat local utile (scroll/filtres) quand possible.

## 10. UX/UI Spec - Module Evenements

Perimetre ecrans:
- `app/events/[id].tsx` -> Detail evenement
- `app/events/create.tsx` -> Entree creation
- `app/events/create/step-1.tsx` -> Informations principales
- `app/events/create/step-2.tsx` -> Medias
- `app/events/create/step-3.tsx` -> Localisation & parametres
- `app/events/create/preview.tsx` -> Previsualisation

### 10.1 Objectifs UX
- Permettre la consultation d'un evenement en quelques secondes (informations essentielles visibles immediatement).
- Rendre la creation guidee, rapide et rassurante avec une progression claire.
- Limiter l'abandon du funnel de creation via validations progressives et feedback instantane.
- Garantir que l'utilisateur voit exactement ce qui sera publie avant confirmation.

### 10.2 Parcours principal
1. Entree depuis carte/accueil/profil -> `events/[id]` (consultation).
2. Entree creation depuis tab `create` ou CTA -> `events/create` puis `step-1`.
3. Progression:
1. `step-1` -> infos principales
2. `step-2` -> medias
3. `step-3` -> localisation & parametres
4. `preview` -> verification finale et publication
4. Publication reussie -> redirection detail evenement ou feed cible.

### 10.3 Spec consultation

#### A. `app/events/[id].tsx` (Detail evenement)
Role fonctionnel:
- Ecran reference pour comprendre, evaluer et rejoindre un evenement.

Contenu prioritaire (ordre de lecture):
1. Hero visuel (cover/carrousel)
2. Titre evenement
3. Date/heure
4. Lieu (distance si disponible)
5. Organisateur
6. Description
7. Actions (participer, partager, favoris, signaler)

UI attendue:
- Header immersif (mode modal) avec action retour claire.
- Section sticky ou visible pour CTA principal de participation.
- Blocs d'information hiérarchises et scannables.

Etats UX:
- loading skeleton (media + blocs texte)
- success
- error recuperation donnees (retry + retour)
- evenement indisponible/supprime (message explicite + sortie)

Regles:
- Un media indisponible ne doit pas casser le rendu global.
- Les actions asynchrones (favori, participation) doivent etre optimistes ou clairement confirmees.
- Les actions sensibles (signalement) necessitent confirmation.

Accessibility:
- Ordre de lecture logique pour lecteurs d'ecran.
- Toutes les actions principales accessibles clavier/ecran tactile.

### 10.4 Spec creation (funnel multi-step)

#### B. `app/events/create.tsx` (Entree creation)
Role fonctionnel:
- Ecran d'amorcage du wizard.

Objectifs UX:
- Expliquer rapidement l'effort attendu (nombre d'etapes, temps estime).
- Lancer la creation sans ambiguite.

UI attendue:
- Resume court du processus (4 etapes).
- CTA principal "Commencer" -> `step-1`.
- CTA secondaire "Annuler/Retour" clair.

Regles:
- Utilisateur invite: redirection vers auth gate avant acces wizard.
- Reprise brouillon si donnees creation deja en memoire locale.

#### C. `app/events/create/step-1.tsx` (Informations principales)
Role fonctionnel:
- Capturer le coeur semantique de l'evenement.

Champs minimaux recommandes:
1. Titre
2. Categorie/type
3. Date(s) et horaire(s)
4. Description courte

UI attendue:
- Form vertical avec sections compactes.
- Validations inline immediates.
- CTA bas de page: "Continuer" (primaire), "Retour" (secondaire).

Regles de validation:
- Titre requis, longueur min/max definie.
- Au moins une date valide.
- Coherence horaire debut/fin.
- Description min si requise metier.

Etats:
- erreurs inline champ par champ
- blocage CTA si invalidite
- sauvegarde locale progressive pour eviter perte

#### D. `app/events/create/step-2.tsx` (Medias)
Role fonctionnel:
- Ajouter les elements visuels qui augmentent l'attractivite.

UI attendue:
- Zone cover principale.
- Galerie medias additionnels (optionnelle).
- Actions: ajouter, supprimer, reordonner (si supporte).

Regles UX:
- Montrer contraintes explicites (formats, taille max, nombre max).
- Upload asynchrone avec progression visible.
- Erreur upload non bloquante tant qu'un minimum requis est respecte.

Validation:
- Cover requise si regle metier active.
- Au moins 1 media valide avant passage etape suivante si obligatoire.

#### E. `app/events/create/step-3.tsx` (Localisation & parametres)
Role fonctionnel:
- Finaliser le contexte de diffusion et les regles de l'evenement.

Champs typiques:
1. Adresse/lieu (picker + recherche)
2. Parametres de visibilite (public/prive)
3. Capacite, reservation, tags, options annexes (selon metier)

UI attendue:
- Bloc localisation prioritaire.
- Bloc parametres en sections accordions ou cartes.
- Aide contextuelle concise pour options avancees.

Regles de validation:
- Localisation requise (si evenement physique).
- Visibilite definie explicitement.
- Capacite > 0 si champ renseigne.

Etats:
- recherche adresse en cours
- aucun resultat adresse
- erreur geocodage avec fallback saisie manuelle

#### F. `app/events/create/preview.tsx` (Previsualisation)
Role fonctionnel:
- Ecran de verification avant publication definitive.

Objectifs UX:
- Reduire les erreurs publiees.
- Donner confiance avant confirmation.

UI attendue:
- Rendu proche du detail reel (`events/[id]`) en lecture seule.
- Resume des sections:
1. infos
2. medias
3. localisation & parametres
- CTA:
1. "Publier" (primaire)
2. "Modifier" (retour vers etape cible)

Regles:
- Publication desactivee si un pre-requis global manque.
- Double tap publication prevenu (verrou pendant submit).
- Succes publication avec feedback clair et redirection.

### 10.5 Etats transverses (module)
- Sauvegarde brouillon locale entre etapes.
- Recuperation brouillon apres fermeture involontaire.
- Gestion offline:
1. consultation: mode degrade (cache si disponible)
2. creation: stockage local et reprise quand reseau revient (si supporte)
- Erreurs API uniformisees:
1. message utilisateur court
2. detail technique loggue cote dev

### 10.6 Microcopy recommandees
- `step-1` CTA: "Continuer vers les medias"
- `step-2` CTA: "Continuer vers la localisation"
- `step-3` CTA: "Previsualiser mon evenement"
- `preview` CTA final: "Publier l'evenement"
- Erreur publication: "Impossible de publier pour le moment. Reessayez dans quelques instants."

### 10.7 Critieres d'acceptation UX/UI
- Le detail evenement affiche titre, date, lieu et CTA principal sans scroll excessif.
- Le wizard creation rend visible la progression (etape courante + total).
- L'utilisateur ne peut pas avancer si les champs requis de l'etape courante sont invalides.
- La navigation retour conserve les donnees deja saisies.
- L'upload media expose un etat de progression et un etat d'erreur explicite.
- La previsualisation reflète fidèlement les donnees qui seront publiees.
- Le bouton publier n'envoie qu'une seule requete active a la fois.

## 11. UX/UI Spec - Espace Createur

Perimetre ecrans:
- `app/creator/index.tsx` -> Vue principale createur
- `app/creator/dashboard.tsx` -> Tableau de bord
- `app/creator/fans.tsx` -> Abonnes / communaute
- `app/creator/[id].tsx` -> Detail contenu ou campagne

### 11.1 Objectifs UX
- Donner une vision claire de la performance createur en un coup d'oeil.
- Rendre actionnables les indicateurs (du chiffre vers l'action).
- Faciliter l'animation de la communaute et la fidelisation des abonnes.
- Structurer un parcours "overview -> analyse -> action" sans surcharge.

### 11.2 Parcours principal
1. Entree depuis menu profil -> `creator/index`.
2. Depuis la vue principale:
1. navigation vers `creator/dashboard` pour detail KPIs
2. navigation vers `creator/fans` pour gestion communaute
3. navigation vers `creator/[id]` pour detail contenu/campagne
3. Retour constant vers la vue principale pour maintenir le contexte global.

### 11.3 Spec par ecran

#### A. `app/creator/index.tsx` (Vue principale)
Role fonctionnel:
- Hub de pilotage createur avec resume de l'activite recente.

Objectifs UX:
- Repondre vite a "Ou j'en suis ?" et "Que dois-je faire ensuite ?".

UI attendue:
- Header createur (identite, periode analysee, filtre temporel).
- Bloc KPI resume (ex: vues, interactions, conversion, croissance).
- Section "Actions recommandees" priorisee (3 max visibles sans scroll excessif).
- Acces directs vers dashboard, fans, campagnes.

Etats UX:
- loading skeleton cartes KPI
- success
- empty (nouveau createur sans donnees) avec onboarding metier
- error (retry + fallback donnees dernier cache)

Regles:
- Afficher timestamp de fraicheur des donnees ("Mis a jour il y a ...").
- Les KPIs critiques doivent inclure variation vs periode precedente.

#### B. `app/creator/dashboard.tsx` (Tableau de bord)
Role fonctionnel:
- Analyse detaillee des performances.

Objectifs UX:
- Permettre l'identification des leviers de croissance.
- Supporter les decisions rapides via visualisations lisibles.

UI attendue:
- Filtres globaux (periode, type de contenu, zone si applicable).
- Graphiques:
1. tendance temporelle (engagement, portee)
2. repartitions (formats, canaux, audiences)
- Tableau des meilleurs contenus/campagnes.
- CTA contextuels: "Voir detail", "Booster", "Dupliquer campagne".

Regles UX:
- Changement de filtre applique partout de facon coherente.
- Etat chargement partiel par widget (eviter blocage global ecran).
- Legendes et axes explicites, pas de graphe sans unite.

Accessibility:
- Graphiques accompagnes d'une version texte resumee.
- Contraste fort sur courbes/barres et labels.

#### C. `app/creator/fans.tsx` (Abonnes / communaute)
Role fonctionnel:
- Gestion et segmentation de la base fans.

Objectifs UX:
- Faciliter l'identification des fans actifs, nouveaux, a relancer.
- Supporter des actions CRM simples depuis la liste.

UI attendue:
- Liste fans avec avatar, nom, score/etat d'engagement, derniere interaction.
- Outils de tri et filtres (actifs, inactifs, VIP, recents).
- Bloc insights (croissance abonnes, churn, engagement moyen).
- Actions rapides:
1. voir profil fan
2. lancer interaction (message/invitation selon permissions)
3. tagger/segmenter

Etats UX:
- loading liste + insights
- resultats
- empty (aucun abonne) avec CTA acquisition
- error recuperation

Regles:
- Filtres persistants dans la session courante.
- Scroll infini pagine avec indicateur de chargement discret.

#### D. `app/creator/[id].tsx` (Detail contenu ou campagne)
Role fonctionnel:
- Inspection approfondie d'un objet createur (contenu/campagne).

Objectifs UX:
- Comprendre la performance et les causes rapidement.
- Decider d'une action corrective ou de scaling.

UI attendue:
- Header objet (titre, statut, periode, objectif).
- KPIs dedies (reach, engagement, conversion, cout si applicable).
- Timeline des evenements cles (publication, pics, actions modif).
- Bloc recommandations actionnables.
- CTA:
1. modifier
2. dupliquer
3. archiver/terminer (avec confirmation)

Etats:
- loading detail
- success
- not found/supprime
- permission refusee (si non proprietaire/non role autorise)

Regles:
- Les actions irreversibles demandent une confirmation explicite.
- Conserver les filtres de contexte lors du retour vers dashboard/index.

### 11.4 Etats transverses (module createur)
- Donnees analytics potentiellement retardees: afficher latence connue.
- Gestion role/permissions:
1. utilisateur non createur -> message d'acces restreint + CTA upgrade
2. createur sans droit sur ressource -> vue lecture seule
- Gestion hors-ligne:
1. lecture degradee sur dernier cache
2. actions ecriture desactivees avec message clair
- Standardiser les erreurs API et proposer retry systematique.

### 11.5 Microcopy recommandees
- Vue principale CTA: "Voir mon tableau de bord"
- Dashboard empty: "Pas encore assez de donnees. Publiez votre premier contenu."
- Fans empty: "Aucun abonne pour le moment. Invitez votre communaute."
- Detail campagne erreur: "Impossible de charger cette campagne. Reessayez."

### 11.6 Critieres d'acceptation UX/UI
- `creator/index` affiche un resume KPI lisible en moins de 2 scrolls.
- `creator/dashboard` applique les filtres de facon coherente a tous les widgets.
- `creator/fans` permet de filtrer et retrouver un segment en moins de 3 interactions.
- `creator/[id]` expose statut, objectifs et KPIs principaux sans navigation secondaire.
- Les etats `loading`, `empty`, `error`, `forbidden` sont definis pour les 4 ecrans.
- Les actions sensibles (archiver, terminer) exigent une confirmation utilisateur.

## 12. UX/UI Spec - Parametres

Perimetre ecrans:
- `app/settings/index.tsx`
- `app/settings/notifications.tsx`
- `app/settings/account/email.tsx`
- `app/settings/account/personal.tsx`
- `app/settings/account/preferences.tsx`
- `app/settings/security/account.tsx`
- `app/settings/security/password.tsx`
- `app/settings/security/sessions.tsx`
- `app/settings/privacy/delete.tsx`
- `app/settings/privacy/export.tsx`
- `app/settings/privacy/policy.tsx`
- `app/settings/legal/cgu.tsx`
- `app/settings/legal/cookies.tsx`
- `app/settings/legal/mentions.tsx`

### 12.1 Objectifs UX
- Centraliser les reglages utilisateur dans une architecture claire et previsible.
- Permettre la modification d'un parametre critique en moins de 3 interactions.
- Reduire le risque d'erreur sur les donnees sensibles (email, informations personnelles).
- Donner un feedback explicite apres chaque changement (sauvegarde, erreur, annulation).

### 12.2 Parcours principal
1. Entree depuis profil/menu -> `settings/index`.
2. Selection d'une categorie:
1. notifications
2. email
3. personal
4. preferences
5. security (account/password/sessions)
6. privacy (delete/export/policy)
7. legal (cgu/cookies/mentions)
3. Edition des champs/toggles.
4. Sauvegarde explicite ou auto-save selon type de reglage.
5. Retour settings avec etat synchronise.

### 12.3 Spec par ecran

#### A. `app/settings/index.tsx` (Hub Parametres)
Role fonctionnel:
- Ecran sommaire d'acces a tous les sous-reglages.

Objectifs UX:
- Offrir une navigation compréhensible immediatement.
- Eviter les ambiguïtés entre compte, notifications et preferences d'usage.

UI attendue:
- Header "Parametres" + eventuel champ de recherche reglages.
- Groupes de sections (Compte, Notifications, Preferences, Securite, RGPD, Legal).
- Items cliquables avec label clair + description courte.

Etats:
- loading initial (si profil/flags necessaires)
- success
- error de chargement partiel (afficher ce qui est disponible)

Regles:
- Conserver la position scroll lors du retour depuis un sous-ecran.
- Afficher badges d'attention si action requise (ex: email non verifie).

#### B. `app/settings/notifications.tsx`
Role fonctionnel:
- Controle fin des canaux et types de notifications.

Objectifs UX:
- Donner a l'utilisateur le controle du bruit sans perdre l'essentiel.

UI attendue:
- Toggles par categorie (activite, rappels, systeme, marketing si applicable).
- Eventuellement sous-options par canal (push, email, in-app).
- Resume de l'impact ("Vous recevrez moins de rappels evenement").

Regles UX:
- Changement toggle applique immediatement ou via bouton "Enregistrer" explicite.
- Si permission OS push refusee: afficher aide + CTA "Ouvrir les reglages systeme".
- Desactivation globale doit rester reversible facilement.

Etats:
- saving (etat inline sur toggle)
- success (confirmation discrète)
- error (rollback visuel + message court)

#### C. `app/settings/account/email.tsx`
Role fonctionnel:
- Modifier l'adresse email de connexion.

Objectifs UX:
- Securiser l'operation et eviter la perte d'acces compte.

UI attendue:
- Affichage email actuel.
- Champ nouvel email.
- Verification mot de passe/identite si requise.
- CTA principal "Mettre a jour l'email".

Regles de validation:
- Format email valide.
- Interdire soumission si identique a l'email actuel.
- Gestion cas deja utilise.

Feedback:
- Message clair si verification email necessaire.
- Etat intermediaire explicite: "Email en attente de confirmation".

#### D. `app/settings/account/personal.tsx`
Role fonctionnel:
- Edition des informations personnelles (profil de base).

Objectifs UX:
- Permettre des modifications rapides et non risquées.

UI attendue:
- Formulaire structure (nom, prenom/pseudo, bio courte, ville selon model metier).
- Inputs labels + aides contextuelles.
- CTA "Enregistrer" fixe ou sticky en bas d'ecran.

Regles:
- Validation inline champ par champ.
- Prevention de perte: alerte si retour avec changements non sauvegardes.
- Afficher date de derniere mise a jour si utile.

Etats:
- idle
- dirty (modifs non sauvegardees)
- saving
- success
- error avec conservation des saisies

#### E. `app/settings/account/preferences.tsx`
Role fonctionnel:
- Reglages de confort et personnalisation de l'experience.

Objectifs UX:
- Adapter l'app aux habitudes utilisateur sans complexite.

UI attendue:
- Toggles/choix pour preferences UX (langue, densite, filtres par defaut, etc. selon metier).
- Sections courtes avec explication de l'effet.
- Eventuel bouton reset "Revenir aux reglages par defaut".

Regles:
- Appliquer en direct les preferences non critiques.
- Pour preferences critiques, demander confirmation.
- Le reset doit demander confirmation avant execution.

#### F. `app/settings/security/account.tsx`
Role fonctionnel:
- Reglages de securite du compte (etat de verification, protections actives, options de recuperation).

Objectifs UX:
- Donner une vue claire du niveau de securite actuel.
- Guider l'utilisateur vers les actions prioritaires de securisation.

UI attendue:
- Score/etat de securite (ex: faible, moyen, eleve) avec explication.
- Liste d'actions: verifier email/phone si applicable, activer protections additionnelles.
- CTA vers modification mot de passe et gestion des sessions.

Regles:
- Mettre en avant les actions critiques non completees.
- Afficher la date de derniere verification sensible quand disponible.

#### G. `app/settings/security/password.tsx`
Role fonctionnel:
- Changement de mot de passe.

Objectifs UX:
- Rendre la mise a jour securisee et sans ambiguite.

UI attendue:
- Champs: mot de passe actuel, nouveau, confirmation.
- Indicateur de robustesse du nouveau mot de passe.
- CTA principal: "Mettre a jour le mot de passe".

Regles de validation:
- Nouveau mot de passe different de l'actuel.
- Respect des contraintes minimales (longueur, complexite si definie).
- Confirmation strictement identique.

Etats:
- saving
- success (message + eventuelle deconnexion autres sessions)
- error (garder les champs non sensibles si possible)

#### H. `app/settings/security/sessions.tsx`
Role fonctionnel:
- Gestion des sessions actives sur les appareils.

Objectifs UX:
- Permettre l'audit et la revocation rapide des acces inconnus.

UI attendue:
- Liste sessions: appareil, plateforme, localisation approximative, derniere activite.
- Identification claire de la session courante.
- Actions:
1. deconnecter une session
2. deconnecter toutes les autres sessions

Regles:
- Confirmation avant revocation globale.
- Feedback immediat apres deconnexion d'une session.
- Session courante non supprimable sans flow explicite de logout local.

#### I. `app/settings/privacy/delete.tsx`
Role fonctionnel:
- Suppression de compte (droit a l'effacement).

Objectifs UX:
- Prevenir les suppressions accidentelles.
- Expliquer clairement les consequences.

UI attendue:
- Encadre d'avertissement fort (irreversibilite, impact sur donnees).
- Checkboxes de comprehension.
- Champ de confirmation (ex: taper "SUPPRIMER").
- CTA destructif final.

Regles:
- Double confirmation obligatoire.
- Exiger re-authentification recente si necessaire.
- Afficher delai de traitement et eventuelle periode de grace.

#### J. `app/settings/privacy/export.tsx`
Role fonctionnel:
- Export des donnees personnelles (droit a la portabilite).

Objectifs UX:
- Permettre une demande d'export simple et tracable.

UI attendue:
- Description des donnees exportees.
- CTA "Demander mon export".
- Etat de la demande:
1. non demandee
2. en preparation
3. disponible (telechargement)
4. expiree

Regles:
- Donner une estimation de delai.
- Lien de telechargement limite dans le temps.
- Journal des demandes recentes.

#### K. `app/settings/privacy/policy.tsx`
Role fonctionnel:
- Consultation de la politique de confidentialite (version RGPD).

Objectifs UX:
- Rendre le document legal lisible et consultable facilement sur mobile.

UI attendue:
- Titre, version, date de mise a jour.
- Sommaire ancre (sections cliquables).
- Affichage texte legal avec bonne hierarchie typographique.

Regles:
- Support du scroll long avec retour haut rapide.
- Mettre en evidence la date de derniere revision.

#### L. `app/settings/legal/cgu.tsx`, `app/settings/legal/cookies.tsx`, `app/settings/legal/mentions.tsx`
Role fonctionnel:
- Consultation des contenus legaux contractuels et informatifs.

Objectifs UX:
- Garantir accessibilite et comprehension minimale des documents legaux.

UI attendue:
- Ecran par document avec:
1. titre
2. version/date
3. contenu structure
- Navigation uniforme entre les documents legaux.

Regles:
- Les documents doivent rester disponibles sans authentification forte additionnelle.
- Le rendu texte doit privilegier lisibilite (taille, interligne, contrastes).
- Ajouter eventuellement un CTA contact support legal en bas de page.

### 12.4 Etats transverses (module parametres)
- Gestion offline:
1. modifications ecriture bloquees ou file d'attente explicite
2. message clair en cas de non-synchro
- Synchronisation multi-device: priorite au dernier changement confirme serveur.
- Erreurs API uniformes avec messages courts et action de retry.
- Journalisation discrete des changements sensibles (email, securite) cote systeme.
- Re-authentification demandee pour operations critiques (mot de passe, suppression, revocation globale).
- Traçabilite des actions sensibles (timestamp, device, action) visible si possible.

### 12.5 Microcopy recommandees
- Settings index: "Choisissez ce que vous souhaitez personnaliser."
- Notifications off: "Vous pourrez toujours reactiver ces alertes plus tard."
- Email pending: "Confirmez votre nouvelle adresse via le lien envoye."
- Unsaved changes: "Vous avez des modifications non enregistrees."
- Password updated: "Mot de passe mis a jour avec succes."
- Delete warning: "Cette action est irreversible et supprimera vos donnees."
- Export ready: "Votre export est pret. Le lien expire dans 24h."

### 12.6 Critieres d'acceptation UX/UI
- Depuis `settings/index`, chaque sous-ecran cible est atteignable en 1 tap.
- Les toggles notifications donnent un feedback visuel immediat sur succes/erreur.
- `email.tsx` empeche la soumission d'un email invalide ou identique.
- `personal.tsx` preserve les saisies en cas d'echec reseau.
- `preferences.tsx` applique correctement les changements apres relance app (persistance).
- Un retour avec modifications non sauvegardees affiche une confirmation utilisateur.
- `security/password.tsx` impose validation ancien/nouveau/confirmation et bloque les cas invalides.
- `security/sessions.tsx` permet de revoquer une session cible avec feedback immediat.
- `privacy/delete.tsx` impose une double confirmation avant suppression.
- `privacy/export.tsx` expose clairement les etats de demande d'export.
- Les pages `policy.tsx`, `cgu.tsx`, `cookies.tsx`, `mentions.tsx` affichent titre, version/date et contenu lisible.

## 13. UX/UI Spec - Moderation (Back-office)

Note de mapping routes:
- Spec metier: `/admin/*`
- Implementation actuelle: `app/moderation/*`

Perimetre ecrans:
- `app/moderation/index.tsx` -> Dashboard moderation
- `app/moderation/events.tsx` -> Moderation evenements
- `app/moderation/comments.tsx` -> Moderation commentaires
- `app/moderation/users.tsx` -> Gestion utilisateurs
- `app/moderation/reports.tsx` -> Signalements
- `app/moderation/media.tsx` -> Validation medias
- `app/moderation/contests.tsx` -> Gestion concours

### 13.1 Objectifs UX
- Permettre une prise de decision de moderation rapide, tracee et coherente.
- Prioriser les risques eleves (abus, illegal, securite utilisateur).
- Reduire le temps moyen de traitement des files de moderation.
- Garantir la lisibilite des statuts et de l'historique d'actions.

### 13.2 Parcours principal
1. Entree moderateur/admin -> `moderation/index`.
2. Consultation files de travail par domaine (`events`, `comments`, `users`, `reports`, `media`, `contests`).
3. Ouverture d'un item -> analyse contexte + preuves.
4. Action:
1. approuver
2. rejeter
3. escalader
4. sanctionner (selon permissions)
5. Confirmation + journalisation + passage item suivant.

### 13.3 Spec par ecran

#### A. `app/moderation/index.tsx` (Dashboard moderation)
Role fonctionnel:
- Cockpit global de supervision moderation.

UI attendue:
- KPIs: volume en attente, SLA, taux d'escalade, charge par file.
- Liste "priorite haute" (items critiques en premier).
- Raccourcis vers chaque file metier.

Regles UX:
- Les indicateurs critiques doivent etre visibles sans scroll.
- Rafraichissement manuel + auto-refresh discret.
- Date/heure de derniere synchro visible.

#### B. `app/moderation/events.tsx` (Moderation evenements)
Role fonctionnel:
- Verification conformite des evenements publies/soumis.

UI attendue:
- Tableau/liste filtrable: statut, date, createur, categorie.
- Apercu rapide contenu (titre, media, lieu, description).
- Actions inline: approuver, masquer, rejeter, demander revision.

Regles:
- Motif de rejet obligatoire.
- Les decisions impactant la visibilite doivent demander confirmation.
- Historique des actions accessible sur chaque evenement.

#### C. `app/moderation/comments.tsx` (Moderation commentaires)
Role fonctionnel:
- Traitement des commentaires problematiques (spam, haine, harcelement).

UI attendue:
- File de commentaires avec contexte conversationnel minimal.
- Mise en evidence automatique de mots/risques (si score dispo).
- Actions: conserver, supprimer, escalader, sanction utilisateur.

Regles:
- Afficher commentaire parent/contexte pour eviter faux positifs.
- Conserver trace du motif et du moderateur ayant agi.

#### D. `app/moderation/users.tsx` (Gestion utilisateurs)
Role fonctionnel:
- Application des mesures sur comptes utilisateurs.

UI attendue:
- Fiche utilisateur: statut, historique signalements, sanctions, role.
- Actions:
1. avertissement
2. suspension temporaire
3. bannissement
4. levee de sanction

Regles:
- Permissions strictes par role (moderateur vs admin).
- Toute action sensible doit exiger confirmation + motif.
- Afficher impact et duree de sanction avant validation.

#### E. `app/moderation/reports.tsx` (Signalements)
Role fonctionnel:
- Traitement central des signalements multi-objets.

UI attendue:
- Queue unifiee avec filtres: type objet, gravite, anciennete, statut.
- Panneau detail: contenu signale, raison, preuve, historique.
- Actions: cloturer, relancer investigation, rediriger file specialisee.

Regles:
- Tri par severite/anciennete par defaut.
- SLA visuel (retard, a traiter aujourd'hui).
- Deduplication des signalements similaires si possible.

#### F. `app/moderation/media.tsx` (Validation medias)
Role fonctionnel:
- Validation des contenus image/video soumis.

UI attendue:
- Grille ou file media avec apercu grand format.
- Metadonnees: auteur, date, objet associe, score risque.
- Actions: approuver, refuser, flouter/masquer, escalader.

Regles:
- Afficher raisons standardisees de refus.
- Permettre navigation clavier rapide pour modération en volume.
- Marquer clairement contenus sensibles avant ouverture pleine taille.

#### G. `app/moderation/contests.tsx` (Gestion concours)
Role fonctionnel:
- Controle reglementaire et operationnel des concours.

UI attendue:
- Liste concours: statut, dates, organisateur, volume participation.
- Detail: regles, eligibilite, preuves, incidents.
- Actions: valider, suspendre, clore, invalider participation.

Regles:
- Verification coherence dates et regles avant publication.
- Historiser toutes les modifications de statut.

### 13.4 Etats transverses (module moderation)
- Etats standards par ecran:
1. loading
2. empty
3. error
4. forbidden (acces refuse)
- Concurrence de moderation:
1. lock optimiste sur item en cours de traitement
2. message si item deja traite par un autre moderateur
- Traçabilite obligatoire:
1. qui
2. quoi
3. quand
4. pourquoi
- Escalade et audit:
1. piste d'audit exportable
2. horodatage UTC + timezone affichable localement

### 13.5 Microcopy recommandees
- Dashboard: "X elements critiques a traiter."
- Action reject: "Selectionnez un motif de rejet pour continuer."
- Conflict: "Cet element vient d'etre traite par un autre moderateur."
- Success: "Action enregistree et historique mis a jour."
- Forbidden: "Vous n'avez pas les droits pour effectuer cette action."

### 13.6 Critieres d'acceptation UX/UI
- `moderation/index` expose au moins les KPIs file en attente + priorites.
- Chaque file (`events/comments/users/reports/media/contests`) supporte filtre + tri + action moderation.
- Une action de moderation sensible exige un motif et une confirmation.
- Toute action effectuee est visible dans un historique d'audit lie a l'item.
- En cas de conflit de concurrence, l'utilisateur est informe sans perte de contexte.
- Les etats `loading`, `empty`, `error`, `forbidden` sont implementes sur chaque ecran du module.

## 14. UX/UI Spec - Qualite & Support

Note de mapping routes:
- Spec metier: `/support/bug-report`
- Implementation actuelle: `app/bug-report.tsx`

Perimetre ecran:
- `app/bug-report.tsx` -> Signalement bug

### 14.1 Objectifs UX
- Permettre a l'utilisateur de signaler un probleme en moins de 2 minutes.
- Collecter des informations exploitables par l'equipe produit/tech sans surcharger le formulaire.
- Donner un feedback clair de prise en compte apres soumission.

### 14.2 Parcours principal
1. Entree depuis menu profil/parametres -> ecran bug report.
2. Saisie du signalement (titre, description, contexte).
3. Ajout optionnel de pieces jointes (captures ecran).
4. Soumission.
5. Confirmation de reception + retour navigation.

### 14.3 Spec ecran

#### A. `app/bug-report.tsx` (Signalement bug)
Role fonctionnel:
- Point d'entree unique pour remonter les anomalies fonctionnelles et techniques.

UI attendue:
- Header clair: "Signaler un bug".
- Formulaire simple:
1. categorie du probleme (optionnel mais recommande)
2. titre court (obligatoire)
3. description detaillee (obligatoire)
4. etapes pour reproduire (recommande)
5. piece jointe media (optionnelle)
- Bloc contexte auto-collecte visible:
1. version app
2. plateforme/OS
3. date/heure locale
- CTA principal: "Envoyer le signalement".

Regles UX:
- Validation inline des champs obligatoires.
- Garder les saisies en cas d'erreur reseau/API.
- Afficher progression d'upload si media joint.
- Desactiver le CTA pendant soumission pour eviter double envoi.

Etats:
- idle
- dirty
- submitting
- success (confirmation)
- error (message + retry)

Accessibility:
- Labels explicites, champs facilement focalisables.
- Contraste conforme pour messages erreur/succes.
- Zones tactiles minimum 44x44.

### 14.4 Etats transverses (support)
- Offline: proposer sauvegarde locale temporaire et renvoi ulterieur si possible.
- Erreurs API standardisees avec message utilisateur court.
- Rate limiting anti-spam cote backend avec message explicite cote UI.

### 14.5 Microcopy recommandees
- Intro: "Decrivez le probleme rencontre pour nous aider a le corriger rapidement."
- Success: "Merci, votre signalement a bien ete envoye."
- Error: "Impossible d'envoyer le signalement pour le moment. Reessayez."
- Attachment hint: "Ajoutez une capture pour accelerer le diagnostic."

### 14.6 Critieres d'acceptation UX/UI
- L'ecran permet l'envoi d'un signalement avec titre + description obligatoires.
- Une piece jointe peut etre ajoutee et son upload affiche un etat de progression.
- Le bouton d'envoi est bloque pendant `submitting` pour eviter les doublons.
- En cas d'erreur reseau, les champs restent renseignes et un retry est propose.
- Un message de confirmation est affiche apres soumission reussie.

## 15. UX/UI Spec - Main Feed (HomeScreen)

Note de mapping routes:
- Route tab: `app/(tabs)/index.tsx`
- Ecran cible: `src/screens/home/HomeScreen.tsx`

Perimetre fonctionnel:
- Recherche rapide et filtres (SearchBar + tri + meta filtres).
- Story strip createurs.
- Flux principal d'evenements (cards).
- Actions sociales (like, favori), navigation, itineraire.

### 15.1 Objectifs UX
- Offrir un point d'entree editorial "Pour vous" des l'ouverture.
- Permettre de trouver un evenement pertinent en moins de 3 interactions.
- Rendre les actions principales visibles directement sur les cards (ouvrir, liker, favori, itineraire).
- Conserver un feed fluide, lisible, et reactif au refresh.

### 15.2 Architecture de l'ecran
Zones UI (ordre vertical):
1. Fond applicatif (`AppBackground`)
2. Barre de recherche contextuelle (overlay top)
3. Header section: titre "Pour vous" + controle de tri
4. Meta filtres rapides (Tous / En cours / A venir / Passes)
5. Story strip horizontal (Nouveau + createurs suivis)
6. Liste verticale des evenements (cards)
7. Bottom sheet de navigation (itineraire) sur action card

### 15.3 Design layout & spacing
- Safe area top respectee (`insets.top` + marge).
- Container principal full-screen, background transparent avec `AppBackground`.
- Largeur de contenu feed:
1. barre recherche avec marge horizontale `spacing.md`
2. sections feed avec marge `spacing.sm`
- Story avatars:
1. taille 68x68
2. bordure ronde
3. badge "+" pour item "Nouveau"
- Cards evenement:
1. image hero (statique ici, carousel desactive sur Home feed)
2. overlay infos et CTA
3. coins arrondis (token `large` ou equivalent theme card)

### 15.4 Composants et actions detaillees

#### A. Barre recherche (`SearchBar`)
But:
- Lancer une recherche multicritere events (et membres si active).

Comportement:
- Action "Apply" -> active `searchApplied`, reset meta filtre sur `all`.
- Si aucun critere actif -> retour au feed standard.
- Resume recherche visible quand appliquee.

Actions utilisateur:
1. Ouvrir panneau recherche avancee
2. Definir where/when/who/what
3. Appliquer recherche

#### B. Controle tri (`TriageControl`)
But:
- Controler l'ordre du feed.

Valeurs supportees:
- `triage`, `date`, `endDate`, `created`, `distance`, `popularity`

Actions utilisateur:
1. Ouvrir modal tri
2. Choisir critere
3. Choisir ordre asc/desc (si critere temporel)

Regles:
- Option distance desactivee sans localisation utilisateur.
- Label de tri actif visible dans la pill.

#### C. Meta filtres rapides
Pills:
1. Tous (`all`)
2. En cours (`live`)
3. A venir (`upcoming`)
4. Passes (`past`)

Actions:
- Tap pill -> applique meta filtre.
- Si filtre != `all`, la recherche appliquee est desactivee (retour mode meta feed).

Style:
- Etat actif: fond accentue + bordure active.
- Etat inactif: fond neutre + bordure neutre.

#### D. Story strip horizontal
Item 1 (fixe):
- "Nouveau" -> ouvre `events/create/step-1`.

Items suivants:
- Createurs suivis recents (derniers evenements <= 7 jours).
- Tap item -> ouvre `community/[creatorId]`.

Regles:
- Sans utilisateur connecte ou sans follows: strip limite a "Nouveau".
- Avatar fallback si image indisponible.

#### E. Event cards (`EventResultCard`) dans la liste feed
Actions principales par card:
1. Tap card -> `events/[id]` (detail evenement)
2. Bouton "Itineraire" -> ouvre `NavigationOptionsSheet`
3. Bouton Like (coeur) -> toggle like
4. Bouton Favori (etoile) -> toggle favoris
5. Tap avatar createur -> `community/[creatorId]`

Elements visuels card:
1. badge categorie
2. titre evenement
3. lieu (ville/adresse)
4. date formatee
5. tags (max 3)
6. distance (si calculee/disponible)

Regles interaction:
- Eviter ouverture detail pendant swipe media (protection anti clic parasite).
- Like/Favori doivent refleter l'etat local immediat apres confirmation service.
- Erreur action sociale: ne pas crasher l'UI, log warning.

#### F. Bottom sheet navigation (`NavigationOptionsSheet`)
Declenchement:
- Via CTA "Itineraire" card.

But:
- Proposer options de navigation externe/interne vers le lieu de l'evenement.

Regles:
- Visible seulement si `navEvent` defini.
- Fermeture explicite via action close.

### 15.5 Etats UX & data
- `loadingEvents=true`:
1. loader central
2. texte "Chargement des evenements..."
- `refreshing=true`:
1. pull-to-refresh actif (RefreshControl)
- `searchLoading=true`:
1. empty state temporaire "Recherche en cours..."
- `empty result`:
1. message "Aucun evenement trouve"

### 15.6 Regles de donnees & tri
- Source feed:
1. feed recherche si `searchApplied=true`
2. sinon feed standard `useEvents(limit:100)`
- Tri final applique apres filtrage (meta + search) via `sortEvents`.
- Meta filtre applique avant tri.
- Rayon recherche:
1. radius explicite si fourni
2. fallback 10 km si lieu defini sans rayon

### 15.7 Accessibilite
- Cibles tactiles minimales 44x44 pour boutons overlays (like/favori/itineraire).
- Texte lisible sur overlays image (contraste suffisant via fond assombri).
- Labels d'action explicites recommandes:
1. "Ouvrir evenement"
2. "Ajouter aux favoris"
3. "Aimer evenement"
4. "Ouvrir options d'itineraire"

### 15.8 Microcopy recommandee
- Titre section: "Pour vous"
- Loading: "Chargement des evenements..."
- Recherche: "Recherche en cours..."
- Empty: "Aucun evenement trouve"
- Story CTA: "Nouveau"

### 15.9 Critieres d'acceptation UX/UI
- Le Main Feed affiche recherche + tri + meta filtres avant la liste.
- Le story item "Nouveau" ouvre bien le flow creation (`events/create/step-1`).
- Un tap sur card ouvre le detail evenement correspondant.
- Les actions like/favori sont disponibles sur chaque card et mettent a jour l'etat visuel.
- Le CTA "Itineraire" ouvre un bottom sheet de navigation.
- Pull-to-refresh recharge la liste sans ecran blanc.
- Les etats `loading`, `search loading`, `empty` sont explicitement rendus.
