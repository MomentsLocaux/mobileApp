# UI-RELIEF-001 — proposition visuelle à valider

20 septembre 2026 · branche `feat/ui-relief-event-navigation`.

Ouvrir [proposal.html](./proposal.html) dans un navigateur depuis ce dépôt. La maquette utilise les polices Jakarta et le logo locaux ; elle ne contacte aucun service. Les données et l’illustration de concert sont fictives. Cette proposition HTML ne vaut pas intégration ou validation des composants natifs en cours de développement sur la même branche.

## Trois directions

| Direction | Traitement | Usage proposé |
| --- | --- | --- |
| A — Ligne douce | Contour arrondi, sans aplat | Option sobre, proche du langage actuel |
| B — Duo végétal, recommandée | Contour vert profond, aplat menthe | Navigation et actions, lisibilité à petite taille |
| C — Satin léger | Dégradé discret et tranche décalée | Option plus expressive, à évaluer sur appareil |

Douze pictogrammes sont présentés : accueil, carte, propositions, favoris, profil, membres, notifications, réglages, agenda, lieu, itinéraire, contact. Tracés inspirés de l’ébauche `BrandIcon` présente au début de cette mission. Les flèches et le partage restent des signes fonctionnels simples. Les markers de catégorie gardent leur propre collection et leurs couleurs.

## Fiche événement

- Palette actuelle : page `#F4FBF6`, texte `#1A3329`, accent `#7CB518`, surfaces `#E8F5E9`.
- Couverture puis titre et description courte ; la preuve sociale se place avant les informations pratiques.
- Date et lieu dans deux panneaux. Les icônes poussoirs déplient respectivement les horaires et la carte.
- Tranche de bouton de 3 px, enfoncement de 2 px ; pas de halo permanent. `J’y vais` reste un accès à l’itinéraire, pas une déclaration de participation.
- `Je note la date` devient secondaire pour distinguer les deux CTA. Ce changement de hiérarchie est une proposition à valider : la charte actuelle décrit deux poussoirs anis.
- Partage et cœur dans le hero ; agenda, itinéraire, commentaires, corrections et signalement restent identifiables. La maquette n’est pas une reproduction exhaustive des sections conditionnelles de la vraie fiche.
- La barre d’onglets séparée sous le téléphone sert à examiner les icônes, sans proposer une nouvelle navigation dans la fiche.

## Like

Le cœur actuel possède déjà un rebond. Proposition : une seule séquence au passage inactif → actif, cœur rempli, pic d’échelle 1,20, halo et six éclats discrets, durée totale 480 ms. Pas d’effet au retrait, au montage initial ou pendant le chargement d’un événement déjà aimé.

Le prototype synchronise les deux cœurs et le compteur fictif. L’intégration future doit conserver l’unique callback métier existant, le blocage pendant la requête et la restauration d’état en cas d’échec. Une seule impulsion haptique légère est envisageable sur appareil ; le HTML n’en produit pas.

Réduction des animations : préférence système ou commande dans la maquette, avec changement d’état immédiat. Pour l’intégration native : zones tactiles de 48 px, annonce de l’état actif/désactivé et contrôle avec VoiceOver/TalkBack. Le prototype contient des contrôles de hero de 44 px ; ne pas les recopier tels quels dans l’app.

## État des surfaces de charte

Checklist `docs/CHARTER_UI_SURFACES.md` et règle Cursor lues. Surfaces représentées : hero, actions, calendrier, carte dépliée, preuve sociale, navigation. Les autres sheets, spinners, markers, avatars, onboarding et écrans restent hors de cette proposition. `docs/charte-graphique.md`, référencé par la checklist, est absent du dépôt ; la palette de `src/constants/theme.ts` fait référence. L’ancien `DESIGN_AUDIT.md` décrit encore le thème sombre : ses recommandations de couleurs ne remplacent pas la charte claire actuelle.

## Bottom sheet — faisabilité puis proposition visuelle

La structure de `SearchResultsBottomSheet.tsx` permet un carrousel Spotlight et un encart d’invitation dans un en-tête de liste, suivis de lignes avec image à gauche et actions sociales. Les données de likes/avatars et les callbacks cœur existent déjà. Le partage et l’invitation peuvent réutiliser les parcours système existants.

Adaptations à prévoir dans un ticket distinct : variante de carte horizontale, sélection des éléments Spotlight, en-tête de hauteur mesurée, ajustement de `getItemLayout`/`scrollToEvent`, coordination des gestes horizontaux/verticaux et conservation des positions peek/full. Le regroupement par date nécessite un modèle de sections et doit respecter le tri choisi. Les personnes ayant aimé un événement ne doivent pas être présentées comme des participants. La demande suivante autorise une maquette visuelle : [bottom-sheet-proposal.html](./bottom-sheet-proposal.html), également liée depuis `proposal.html`. Le composant natif reste hors de cette proposition.

## Validation

Recette navigateur : trois directions ; like/unlike et compteurs ; fin d’animation ; réduction système/manuelle ; accordéons horaires/carte ; agenda temporairement désactivé ; retour d’action itinéraire ; sélection d’onglet ; absence de débordement à 390 et 320 px ; absence d’erreurs JavaScript.

Commande locale : `node /private/tmp/verify-ui-design-proposal.cjs` (Playwright et Chrome préinstallés). Résultat : PASS pour tous les scénarios ci-dessus. Captures `proposal-desktop.png`, `proposal-event-390.png` et `proposal-event-320.png` produites ; revue visuelle bureau et 320 px effectuée. Aucun build, typecheck ou lint applicatif requis pour ces seuls fichiers de proposition ; les modifications natives concurrentes nécessitent leur propre recette.

Décisions avant intégration : direction d’icônes A/B/C, hiérarchie agenda/itinéraire et intensité du like. La bottom sheet relève d’une éventuelle demande ultérieure.

## Livraison de la proposition bottom sheet

Spotlight de trois cartes horizontales, encart « Inviter un ami », six événements avec image à gauche, informations sociales, like et partage. La vue date regroupe les événements par jour ; les vues Nouveautés et Les + proches changent réellement l’ordre des données fictives. Likes synchronisés entre les deux présentations. Bouton Carte, poignée cliquable/glissable et bandeau peek pour les deux positions de sheet. Dialogues explicites pour le partage, l’invitation et l’ouverture d’une fiche.

Illustrations SVG locales et avatars à initiales de démonstration : à remplacer par les médias et avatars réels lors de l’intégration. Spotlight utilise ici trois événements choisis pour la maquette ; la règle de sélection reste à définir. Le prototype ne valide pas la coordination des gestes natifs Mapbox/Reanimated.

Recette : `node /private/tmp/verify-bottom-sheet-proposal.cjs` — PASS (lien depuis la proposition initiale, carrousel, six lignes, likes synchronisés, trois tris, dialogues, positions peek/full, glissement de poignée, clavier, réduction des animations, absence de débordement à 320/390 px, aucune erreur JS). Les captures sont dans ce dossier : `bottom-sheet-full.png`, `bottom-sheet-list.png`, `bottom-sheet-peek.png`, `bottom-sheet-desktop.png` et variantes 320/390.

Fichiers de cette extension : nouvelle maquette HTML + captures ; lien ajouté dans `proposal.html` ; présentes notes et ticket UI-RELIEF-001 complétés. Aucun code applicatif modifié par cette extension, donc pas de typecheck, lint ou build d’app.

## Intégration et ajustement — 2026-09-21

Les propositions sont désormais intégrées dans la branche `feat/ui-relief-event-navigation` sous UI-RELIEF-001. À la demande de l’utilisateur, l’encart d’invitation est retiré de la bottom sheet native et de sa maquette. Spotlight utilise des visuels 235×140 avec date sur image ; les lignes ont une miniature 86×104 à gauche, réduite à 70×100 sur écran étroit, une date compacte et les actions sociales. Les couleurs de catégorie proviennent des helpers de taxonomie existants (bordures et badges).

Règles actuelles : Spotlight sélectionne automatiquement trois événements publiés du jeu filtré de la zone via `sortEvents(..., 'triage')` (date, distance, popularité, complétude). Nouveautés = `created_at` décroissant. Les + proches = distance à vol d’oiseau depuis le lieu recherché, sinon GPS ; ordre seulement, mêmes filtres. Spotlight conserve son propre classement.

Recette des composants réels : `build-components-review.cjs` puis `verify-components.cjs`, OK à 320/390 px, y compris saut au 101e événement, likes et retour d’échec. Typecheck OK ; lint 0 erreur / 41 avertissements ; 330 tests de logique OK. Captures préfixées `components-`. La recette native iOS/Android des gestes et du partage reste à effectuer. Les sections de proposition antérieures qui mentionnent une invitation décrivent le premier état, remplacé par cette décision.

### Ajustement validé — 2026-09-22

- « Spotlight » devient **Les moments à découvrir** ; règle de sélection inchangée.
- Carrousel : image carrée, date/heure en surimpression, tarif en bas à droite ; titre, avatars des personnes ayant liké, icône de catégorie, cœur/compteur et partage sous l’image.
- Liste : carré de 140 px (124 px en dessous de 360 px, ajusté à la taille du texte), contour de catégorie conservé. Le bloc de droite a strictement la même hauteur : lieu/titre et date en haut, avatars au milieu, icône seule et actions en bas. Aucun chip de catégorie.
- Sur écran étroit, le bouton de partage garde 48 px et son libellé accessible ; le tarif est placé à côté des avatars. Compteurs élevés en notation compacte, nombre exact dans le libellé du cœur.
- Maquette HTML et fixture des composants mises à jour. L’encart invitation reste supprimé.
- Fichiers applicatifs de cet ajustement : `MapDiscoveryEventCard`, `MapDiscoveryHeader`, option `compactCount` dans `EventHeartButton`. Aucune modification de sélection, de backend, de pins ou des assets logo déjà modifiés dans le workspace.
