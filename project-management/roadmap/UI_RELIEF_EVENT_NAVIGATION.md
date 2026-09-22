# UI-RELIEF-001 — fiche événement et iconographie satinée

Demande utilisateur du 2026-09-20. Branche `feat/ui-relief-event-navigation`, créée depuis `main` propre et synchronisée avec `origin/main` (`9f51c6c`).

## Périmètre

- Moderniser les sections de la fiche événement et ses boutons poussoirs 2.5D.
- Proposer et intégrer une famille d’icônes cohérente pour les onglets, la notification, le cœur et le volet latéral.
- Harmoniser le cœur partagé cartes/fiche, avec animation ponctuelle et respect de la réduction des animations.
- Conserver palette menthe/vert profond/anis, contenus, routes, autorisations, compteurs et callbacks existants.
- Aucun changement backend, dépendance native, logo, feature flag ou périmètre MVP.

## Architecture et recette

Icônes SVG locales, relief précalculé par tracés/dégradés simples, sans rendu 3D. Tokens partagés de relief, boutons et sections réutilisables. Les tests visuels utilisent les vrais composants dans une fixture sans accès aux données utilisateur.

À vérifier : petite largeur, texte long, états actif/inactif/désactivé, tap simple du cœur, réduction des animations, compteurs, boutons horaires/carte/agenda/itinéraire, routes et gardes préservées. Typecheck et lint requis. Captures et résultats à compléter en fin de travail.

## Décision et intégration

Style retenu : **B · Duo végétal** (aplat menthe `#B5DDBB`, contour ink). Les tracés SVG de `proposal.html` sont portés dans `src/constants/brand-icon-artwork.ts` ; `BrandIcon` les rend via `react-native-svg` (déjà dans le projet). Poussoirs : tranche 3 px, coins 15 px, « Je note la date » secondaire, « J’y vais » anis pleine largeur. Cœur : rebond 420 ms + halo + 6 éclats 480 ms, respect de `useReduceMotion`.

## Vérification (2026-09-20)

- `npm run typecheck` : OK
- `npm run lint` : 0 erreur (warnings préexistants)
- `npm run test:filters` : 326 pass, dont `brand icon artwork (Duo végétal)`
- Captures appareil : à faire sur simulateur / device (onglets, fiche, cœur, réduction des animations)


## Complément de proposition — bottom sheet

Demande du 2026-09-20 : rendre visible une proposition de la bottom sheet inspirée des captures transmises. Livrable de conception rattaché à UI-RELIEF-001, sur la même branche ; aucune modification du composant natif.

- `audits/ui-relief-event/bottom-sheet-proposal.html` : Spotlight horizontal, encart invitation, liste avec image à gauche, avatars, likes et partage.
- Accès depuis `proposal.html` ; données fictives, gestes et actions simulés.
- Recette : likes synchronisés, tris, carrousel, sheet peek/full, dialogues, navigation clavier, petit écran et réduction des animations.
- Définition de Spotlight et validation native iOS/Android à traiter avant toute intégration.

## Intégration autorisée — fiche + bottom sheet, couleurs de catégorie

Demande explicite du 2026-09-20 : intégrer les deux propositions, style B Duo végétal, en conservant les couleurs distinctives des catégories. Ce complément fait partie de UI-RELIEF-001 sur la branche existante.

- La fiche conserve son badge de catégorie ; poussoirs Duo végétal, cœur animé et commandes de hero accessibles.
- La liste viewport utilise des lignes compactes et un carrousel Spotlight de trois événements publiés issus du même jeu filtré, classés avec la pertinence existante. Pas de contenu sponsorisé ni de flux supplémentaire.
- Images bordées et badges de catégorie issus de `getCategoryColor` / `getCategoryTextColor` ; marqueurs inchangés.
- Invitation vers le parcours existant ; partage système et likes réels, états occupés partagés entre Spotlight et liste.
- Tris existants conservés ; raccourcis Tous (pertinence), Nouveautés (création décroissante), Les + proches. Regroupement par jour uniquement avec le tri Date de début.
- Liste virtualisée, positions mesurées, reprise bornée du scroll vers un événement ; snap peek/full et gestes existants conservés.

Vérifications intégration (2026-09-21) :

- `npm run typecheck` : OK.
- `npm run lint` : aucune erreur, 41 avertissements dans le dépôt.
- `npm run test:filters` : 330 tests réussis, dont les 4 scénarios de présentation de la carte.
- `node audits/ui-relief-event/build-components-review.cjs` puis `node audits/ui-relief-event/verify-components.cjs` : OK avec les vrais composants React Native rendus sur Web, sans compte ni requête réseau. Service de statistiques et mutation de like simulés.
- Contrôles : couleurs taxonomie sur les bordures, proportions/positions des images à 390 et 320 px, likes synchronisés et échec sans faux compteur, tris et en-têtes de dates, absence d’invitation, peek/full, repositionnement au 101e événement, boutons et cœur de la fiche avec réduction des animations.
- Captures : `audits/ui-relief-event/components-sheet-390.png`, `components-list-390.png`, `components-list-320.png`, `components-detail-320.png`.
- Limite : pas de recette iOS/Android complète des gestes carte/carrousel ou des feuilles de partage natives dans cette session. La fixture valide la présentation et la logique de la sheet ; les RPC réelles restent celles de l’app.

### Ajustement utilisateur — 2026-09-21

Retirer l’encart d’invitation de la bottom sheet. Rapprocher la géométrie des visuels et les lignes événement de `bottom-sheet-proposal.html` : Spotlight 235×140, date sur image, miniature 86×104 à gauche (70×100 sur petit écran), date compacte à droite, titre/social/actions resserrés. Couleurs de catégorie conservées. Cette décision remplace l’invitation prévue plus haut. Les raccourcis sont des tris : `created desc` et distance depuis le lieu recherché, sinon GPS (`resolveSortCenter`) ; Spotlight reste le top 3 de pertinence du jeu filtré.

### Ajustement validé — 2026-09-22

- « Spotlight » devient **Les moments à découvrir** ; règle de sélection inchangée.
- Carrousel : image carrée, date/heure en surimpression, tarif en bas à droite ; titre, avatars des personnes ayant liké, icône de catégorie, cœur/compteur et partage sous l’image.
- Liste : carré de 140 px (124 px en dessous de 360 px, ajusté à la taille du texte), contour de catégorie conservé. Le bloc de droite a strictement la même hauteur : lieu/titre et date en haut, avatars au milieu, icône seule et actions en bas. Aucun chip de catégorie.
- Sur écran étroit, le bouton de partage reste une pastille 34 px icône seule, libellé accessible ; le tarif est placé à côté des avatars. Compteurs élevés en notation compacte, nombre exact dans le libellé du cœur.
- Maquette HTML et fixture des composants mises à jour. L’encart invitation reste supprimé.
- Fichiers applicatifs de cet ajustement : `MapDiscoveryEventCard`, `MapDiscoveryHeader`, option `compactCount` dans `EventHeartButton`. Aucune modification de sélection, de backend, de pins ou des assets logo déjà modifiés dans le workspace.

### Ajustement utilisateur — 2026-09-22 (icônes de catégorie)

La bottom sheet affiche les silhouettes 2.5D de `map-marker-assets` (mêmes PNG que les pins carte), pas les icônes Lucide. Pas de teinte uniforme. Repli inconnu : `BrandIcon` sparkles. Layout, tris et sélection inchangés.

### Ajustement utilisateur — 2026-09-22 (période)

Le tampon date de Spotlight et de la liste ne montre plus seulement le début. Même logique que la liste Accueil : un jour = date + heure ; plusieurs jours = début → fin (`getEventCardDateStamp`). Les en-têtes de regroupement du tri Date restent indexés sur `starts_at`.

### Ajustement utilisateur — 2026-09-22 (chrome des cartes)

Spotlight et liste utilisent le même enveloppe que la liste Accueil : fond `colors.brand.surfaceMuted`, filet 1 px `colors.neutral[200]`, coins `EVENT_CARD_RADIUS`. Plus de contour 2 px de catégorie sur la seule image. La catégorie reste visible via la silhouette. L’événement actif garde un filet de catégorie.

### Ajustement utilisateur — 2026-09-22 (like / partage)

Like et partage de la bottom sheet passent en pastilles outline 34 px (cœur + compteur, share + « Partager »), même famille que `EventHeartButton`. En dessous de 360 px, share icône seule. La liste Accueil gagne le même bouton Partager (`sharePublishedEvent` / `Share.share`). Cœur cover Accueil inchangé (34 px, sans compteur).

### Intégration — 2026-09-22 (fiche tiroir)

Référence Knockk, validée : tap image → même route `map-event/[id]` (modal transparente), pas de deuxième sheet empilée. Maquette : `audits/ui-relief-event/detail-drawer-proposal.html`.

- Image en fond (~56 %), peek ~46 %, panneau `page` coins 28 px qui recouvre / révèle au scroll (parallax). Croix 34 px + compteur photos en chrome. Tap peek = galerie existante (`PlaceMediaGallery.openHero`).
- Catégorie / tags / like+compteur / partage dans le tiroir. Titre compact (ville + chip, 2 lignes). Correction (crayon), ajout photo (+) et signalement (drapeau) restent des pastilles icône 34 px, comme avant — pas de chips texte. Modifier / Supprimer en icône si droits. Poussoirs et CTA inchangés.
- Échos : bandeau d’onglets Avis / Photos orga / Photos communauté en carrousel horizontal pour ne plus rogner la dernière pastille.
