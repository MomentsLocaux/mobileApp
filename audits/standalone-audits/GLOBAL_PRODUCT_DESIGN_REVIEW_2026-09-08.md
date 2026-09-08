# Global Product Design & React Native Experience Review — Moments Locaux

## Cadre de la revue

- **Ticket de rattachement :** `MVP-P1-007 — Harmoniser design visible MVP`
- **Date :** 8 septembre 2026
- **Périmètre :** application mobile Alpha, conformément à `ADR_001`, `ADR_002` et `MVP_SCOPE.md`
- **Matière analysée :** code React Native actuel, design system et documents du dépôt, puis dix captures iOS fournies après la première analyse
- **Statut :** diagnostic et recommandations, sans modification applicative

Le périmètre retenu comprend la découverte locale, la carte, la recherche, les favoris, le social entre membres, les notifications, les propositions, la contribution depuis une affiche, Lumia, le profil, les réglages et les mécanismes de signalement. Les surfaces d'administration mobile, la création organisateur et les fonctionnalités V1/V2 archivées restent hors du périmètre Alpha.

Les premières observations ont été formulées avant réception des captures. Les captures ont ensuite permis de confirmer, nuancer ou remplacer les hypothèses visuelles. Le présent document consolide les deux analyses. Les constats visuels de la section N reposent sur les écrans réellement fournis ; les comportements, animations et états non visibles restent à vérifier sur appareil.

---

## A. Executive diagnosis

### Le vocabulaire visuel propriétaire recommandé

**Moments Locaux devrait parler le langage de l'affiche de quartier qui prend vie.** Une photographie attire, une indication temporelle donne envie de sortir, un repère rattache ce moment à un endroit réel. Ce vocabulaire peut devenir reconnaissable grâce à cinq signatures :

1. une fenêtre photographique asymétrique ;
2. un point de rencontre dérivé du logo ;
3. une carte événement éditoriale ;
4. des repères cartographiques en léger relief ;
5. un mouvement très court d'apparition puis de stabilisation.

La priorité n'est pas d'ajouter des effets. Elle est de faire revenir ces cinq signes avec constance, tout en laissant les événements occuper le premier plan.

Les captures font évoluer cette proposition : la signature graphique devrait davantage dériver du logo existant. Son trait relié, ses points et son petit rayonnement constituent une matière plus personnelle qu'une nouvelle étincelle inventée séparément.

### Observations majeures

1. **Le produit possède une palette, mais pas encore une grammaire visuelle suffisamment contraignante.** Les couleurs relient les composants ; leur composition ne raconte pas toujours la même chose.

2. **La documentation entretient plusieurs identités concurrentes.** `DESIGN.md` décrit encore un produit sombre et cyan, issu notamment d'une référence Stitch. Le thème exécuté est désormais clair et vert. Cette contradiction favorise les régressions.

3. **Le problème des arrondis est confirmé.** Les tokens `sm` et `md` valent tous deux 16 ; `lg` et `xl`, 24. Les captures montrent de grands rectangles arrondis, des capsules de filtres, des boutons capsules, des cards et des halos circulaires. Modifier seulement le rayon ne résoudrait pas le problème : il faut limiter les surfaces encadrées et faire porter la hiérarchie par la photographie, la typographie et l'espace.

4. **Les cards événement mettent trop en concurrence désir et administration.** Image, catégorie, titre, description, lieu, distance, panneau `DÉBUT / FIN`, horaires, preuve sociale et favori sollicitent simultanément l'attention.

5. **Le panneau horaire coûte cher à la hiérarchie.** Il occupe une part importante de la largeur alors que ses informations sont petites. Sur les captures, le titre est tronqué pour préserver une année entière de disponibilité et des valeurs `00:00–23:59`.

6. **La compréhension temporelle est un problème UX prioritaire.** Un écran filtré sur « Aujourd'hui » présente un événement allant du 1er janvier au 31 décembre. Il peut être légitimement actif ce jour-là, mais l'interface ne dit pas si une séance a réellement lieu aujourd'hui. Elle doit distinguer séance datée, récurrence, période de disponibilité et horaire inconnu.

7. **La typographie de marque n'est pas systématiquement appliquée.** Plus Jakarta Sans est chargée, mais plusieurs styles locaux utilisent des graisses ou tailles qui contournent les tokens. Les captures montrent en particulier le réflexe « grand titre très gras + texte gris-vert » sur de nombreuses surfaces.

8. **Le lime est parfois employé au mauvais endroit.** Son contraste avec le fond Mist est de 2,36:1. Il ne convient pas au petit texte ou à un signe fonctionnel essentiel sur fond clair. Le blanc sur le lime n'atteint que 2,48:1.

9. **La navigation contient une ambiguïté réelle.** Cinq icônes sont affichées sans libellés. L'entrée « Profil » ouvre un drawer. L'avatar conserve un anneau lime même lorsque l'onglet n'est pas sélectionné, ce qui concurrence le véritable indicateur actif.

10. **Le bouton de contribution possède davantage de sophistication gestuelle que son usage ne semble en exiger.** Déplacement, inertie et rangement au bord ajoutent une interaction à apprendre. Les captures montrent surtout qu'il recouvre des médias et des commandes dans Accueil, Favoris et Propositions.

11. **Aimer, enregistrer, suivre et participer demandent une clarification sémantique.** Le cœur sert à aimer ou enregistrer un événement, puis apparaît comme commande de suivi d'une personne. Un même symbole porte donc plusieurs objets et effets.

12. **L'application n'est pas dépourvue de motion.** Reanimated, des springs, un composant de révélation et un loader de marque existent déjà. Le problème est leur orchestration et leur cohérence.

13. **Les chargements racontent plusieurs histoires.** Le logo se remplit sur certaines surfaces ; une baguette tourne avec « Roulement de tambour… » dans les propositions. La seconde approche reprend des codes devenus conventionnels pour les fonctionnalités IA et semble détachée de la découverte locale.

14. **Le pourcentage d'analyse d'affiche donne une précision excessive.** Il combine des étapes réelles avec une progression temporelle estimée. Une présentation par étapes serait plus honnête et plus calme.

15. **Les notifications inversent la hiérarchie utile.** « Événement à venir » domine chaque card, tandis que le nom qui distingue une notification de la suivante est secondaire.

16. **Mes suggestions ressemble à une fiche administrative.** Introduction, quota, filtres, type et statut précèdent le titre de la contribution. Le retour de modération est lui-même enfermé dans une card à l'intérieur de la card.

17. **Le fond décoratif est trop présent sur les surfaces utilitaires.** Les vagues, halos jaunes-verts et petits points donnent une atmosphère douce, mais peu liée à un moment ou à un lieu. Leur répétition rend les écrans plus diffus et réduit le contraste perceptif.

18. **L'authentification exprime surtout la nature et le bien-être.** La scène lumineuse et les panneaux translucides sont agréables, mais peuvent évoquer une application de méditation ou de sorties douces plus qu'une actualité locale vivante.

19. **La carte possède déjà une bonne fondation technique.** Les événements passent par des `ShapeSource` et `SymbolLayer`. Une identité de repères 2,5D peut prolonger cette architecture sans embarquer de moteur 3D temps réel.

20. **La qualité et la nature des médias seront déterminantes.** La direction éditoriale doit fonctionner avec de belles photos, des affiches verticales, des images médiocres et des événements sans image.

### Conclusion exécutive

Les captures confirment que le défaut principal n'est pas l'absence de polish. **La hiérarchie du contenu et la compréhension des événements doivent passer avant les effets visuels.** Une refonte réussie doit d'abord rendre un événement désirable, temporellement compréhensible et spatialement situé. L'identité propriétaire vient ensuite de cinq signatures récurrentes, pas d'une accumulation de décorations.

---

## B. What currently makes Moments Locaux look generic

« Générique » décrit ici un effet de perception. Cela ne permet pas de déduire comment l'interface a été produite.

| Observation | Impact : pourquoi cela paraît générique | Sévérité | Recommandation |
|---|---|---:|---|
| Deux couples de radius équivalents dans les tokens | Toutes les surfaces semblent appartenir au même kit | Forte | Assigner une géométrie à chaque fonction : image, contrôle, panneau, personne |
| Empilement de capsules : catégories, métadonnées, filtres, états | Chaque information devient un petit composant autonome | Forte | Réserver les capsules à la sélection ; utiliser du texte et l'espace pour les métadonnées |
| Grands rectangles blancs répétés dans Suggestions et Notifications | Chaque item devient une unité flottante identique | Forte | Employer des listes éditoriales séparées par l'espace ou une ligne |
| Panneau `DÉBUT / FIN` dans la card événement | Évoque une fiche de base de données | Forte | Afficher une phrase temporelle ; reporter le détail complet dans l'événement |
| Titre local très gras sans famille explicite | Mélange de signatures typographiques | Forte | Passer tous les textes par des variantes typographiques nommées |
| Loader centré dans un panneau arrondi, avec titre et sous-titre | Composition interchangeable avec un écran bancaire ou SaaS | Moyenne | Charger dans la structure du contenu attendu |
| Baguette magique, grand cercle et « Roulement de tambour… » | Codes convenus des assistants IA | Forte | Remplacer par un fragment d'affiche qui apparaît |
| `EmptyState` fondé sur icône circulaire, texte centré et bouton capsule | Pattern lisible mais sans lien particulier avec le produit | Moyenne | Petite scène graphique issue du même système que les repères |
| Bordures sombres résiduelles dans les propositions | Impression de couches successives | Forte | Tokens sémantiques uniques, puis revue des surfaces recensées |
| Gradient sombre systématique sous certaines images | Traitement décoratif lorsqu'aucun texte ne nécessite de protection | Moyenne | Gradient uniquement pour protéger un contenu superposé |
| Cinq icônes de navigation sans libellés | La navigation repose sur des conventions parfois ambiguës | Forte | Libellés permanents et état actif par forme, couleur et texte |
| Anneau vert permanent de l'avatar de profil | Il ressemble à un deuxième état actif | Moyenne | Anneau neutre hors sélection, sauf s'il porte une information explicitée |
| FAB déplaçable omniprésent | Un composant spectaculaire concurrence et recouvre le contenu | Forte | Point d'entrée fixe et explicite vers la contribution |
| Fond à vagues, halos et points sur les listes | Décoration atmosphérique peu reliée aux événements | Moyenne | Mist uni sur les écrans utilitaires ; motif réservé à quelques scènes de marque |
| « tes propositions » / « vos favoris » / « tu vérifies » | Voix de produit assemblée par morceaux | Forte | Vouvoiement commun et glossaire des objets |
| « Événement à venir » répété en titre de notification | Le patron de notification domine son contenu distinctif | Forte | Nom de l'événement d'abord ; motif et date ensuite |
| « ÉVÉNEMENT SUGGÉRÉ » répété sur chaque contribution | Le type devient plus important que le contenu | Moyenne | Afficher le type seulement lorsqu'il distingue réellement les items |
| Pourcentage d'analyse partiellement estimé | Donne une fausse impression de précision technique | Moyenne | Étapes réelles, sans pourcentage pendant les phases indéterminées |
| Nombreux éléments centrés dans les loaders et l'auth | Manque de tension et de continuité éditoriale | Moyenne | Revenir à une structure alignée sur le contenu futur |
| Cœur employé pour événement et profil suivi | Iconographie uniforme mais sémantique imprécise | Forte | Séparer Enregistrer, Aimer et Suivre |

---

## C. What should absolutely be kept

| Élément | Décision | Pourquoi |
|---|---|---|
| Palette Mist / Forest / Lime / Berry | **KEEP** | Elle porte une identité chaleureuse, adulte et énergique |
| Place centrale de la photographie | **KEEP** | C'est le moyen le plus direct de susciter la curiosité |
| Logo et son mouvement de trait / point / rayonnement | **KEEP + DEVELOP** | Il offre une origine propriétaire aux icônes, repères et mouvements |
| Continuité liste → carte → détail | **KEEP** | Elle correspond au passage de l'envie à un lieu réel |
| Variantes de cards déjà centralisées | **REFINE** | Bonne base de mutualisation |
| Recherche, filtres et conservation du contexte | **KEEP** | La personnalité ne doit pas dégrader l'efficacité |
| Favoris et social entre membres | **KEEP** | Ils prolongent la découverte sans exiger un réseau social complet |
| Statuts textuels des contributions | **KEEP** | « En validation », « Publié » et « Refusé » restent compréhensibles sans couleur seule |
| Retours sur les contributions | **KEEP** | Ils rendent le fonctionnement transparent |
| Stepper partagé pour les suggestions | **REFINE** | Il évite de multiplier les parcours |
| Reanimated, Gesture Handler et SVG existants | **KEEP** | Ils suffisent à une grande partie de la proposition |
| `useReduceMotion`, `MotionReveal`, loader de marque | **REFINE** | Des fondations utiles existent déjà |
| `ShapeSource`, `SymbolLayer`, localisation native | **KEEP** | Architecture adaptée à une carte dense |
| Avatar + nom + ville dans la liste de suivis | **KEEP** | Cette structure est simple et immédiatement lisible |
| Parcours de signalement, support et confidentialité | **KEEP** | Ils appartiennent au MVP public et doivent rester simples |

Plus Jakarta Sans doit également être conservée pour la première version du système v2. Changer de police maintenant masquerait un problème de composition qui resterait entier.

---

## D. Visual identity opportunities

Le territoire propre à Moments Locaux se situe à la rencontre de trois objets :

- **L'affiche :** quelque chose mérite votre attention.
- **Le repère :** cela se passe ici.
- **L'instant :** cela devient pertinent maintenant.

La marque doit traduire cette relation à différentes échelles. Une card événement est une affiche lisible ; son marker en est la version condensée ; son apparition est le même geste réduit dans le temps.

### Opportunités concrètes révélées par les captures

1. **Employer le logo comme matrice.** Son trait relié peut former une ligne de lieu, une liaison entre deux points ou une ouverture. Son rayonnement peut signaler une apparition ou un moment actuel. Ces caractéristiques doivent être simplifiées, sans reproduire le logo partout.

2. **Rendre la photographie documentaire.** Les images devraient montrer un lieu occupé, un geste, une ambiance ou une affiche réelle. La photographie d'authentification peut devenir plus locale et moins génériquement « bien-être ».

3. **Rendre le temps visible en langage courant.** « Aujourd'hui · 18 h », « Plusieurs dates », « Disponible jusqu'au 30 septembre » ou « Horaires à vérifier » sont plus utiles qu'une colonne technique systématique.

4. **Rendre le lieu tangible.** Une ligne de lieu simple, un repère reconnaissable et une distance correctement qualifiée suffisent. Il n'est pas nécessaire de transformer chaque élément en capsule.

5. **Faire respirer les surfaces utilitaires.** Un fond Mist uni donnera plus de force aux images, aux titres et aux états. Les vagues et points peuvent rester sur l'entrée ou quelques scènes de marque.

### Principes de benchmark

Les applications consumer remarquables paraissent conçues par une grande équipe lorsque la même décision résiste à tous les contextes : belle image, mauvais média, chargement, erreur, texte long, carte dense et accessibilité.

- **Spotify :** cohérence entre contenu, typographie, voix et comportements. Application à Moments Locaux : organiser toute l'expérience autour de l'événement local, sans importer la densité ou les codes musicaux.
- **Airbnb :** photographie dominante, texte explicite et continuité entre aperçu et détail. Application : donner envie puis faciliter la décision, sans reprendre le vocabulaire de réservation.
- **AllTrails :** découverte accompagnée d'informations réellement actionnables. Application : après l'inspiration, rendre date, lieu et accès immédiatement utilisables, sans étendre l'Alpha vers un produit d'itinéraires.

Références : [rétrospective design de Spotify](https://newsroom.spotify.com/2026-04-23/spotify-design-history/), [étude Airbnb publiée par Google Design](https://design.google/library/airbnb-invites-you-in), [présentation produit d'AllTrails](https://www.alltrails.com/press/alltrails-expands-membership-offering-with-alltrails-peak).

---

## E. Three art directions

| Dimension | 1. **Les affiches du coin** | 2. **L'atlas sensible** | 3. **Les instants ouverts** |
|---|---|---|---|
| Concept | Un mur d'affiches contemporain, édité pour le téléphone | Un quartier miniature que l'on explore | Des fenêtres photographiques qui s'ouvrent sur la vie locale |
| Sensation | Culturelle, humaine, spontanée, adulte | Curieuse, tangible, légèrement ludique | Calme, immersive, contemporaine |
| Géométrie | Rectangles éditoriaux, un angle distinctif, alignements décalés | Repères, petits socles, lignes de liaison | Grandes ouvertures, superpositions et marges amples |
| Cards | Image puis titre et ligne temporelle, sans boîte englobante obligatoire | Aperçu relié visuellement à un lieu | Image dominante avec peu d'informations visibles |
| Icons | Trait ouvert et point décentré dérivés du logo | Petites silhouettes cartographiques | Symboles très sobres à contours interrompus |
| Map markers | Mini-affiches épaisses | Objets 2,5D par famille d'activité | Balises plates et temporalité discrète |
| Motion | Dévoilement court, puis fixation | Émergence et léger soulèvement | Fondu et déploiement |
| Typography | Éditoriale, contrastes de tailles, alignement gauche | Compacte et informative | Grands titres, poids plus modérés |
| Photography | Documentaire, gestes, lieux occupés, affiches réelles | Photo secondaire à la carte, première dans l'aperçu | Photo presque plein écran |
| Forces | Lien direct avec la découverte et la contribution depuis une affiche | Signature cartographique très forte | Désir immédiat, interface légère |
| Risques | Dérive scrapbook, fausse texture papier, surcharge de stickers | Dérive jeu mobile ou carte touristique | Dépendance aux belles photos, faible densité |
| Difficulté React Native | **4/10** | **7/10** | **5/10** |
| Robustesse aux médias imparfaits | Bonne avec une variante affiche et un fallback typographique | Bonne sur la carte | Plus faible |

---

## F. Recommended art direction

### Les affiches du coin — quelque chose apparaît ici

Cette direction reste la recommandation principale. L'atlas sensible mérite une expérimentation ciblée sur les markers, mais ne doit pas devenir une seconde direction artistique concurrente.

Le système repose sur cinq signatures précises :

| Signature | Règle | Justification produit |
|---|---|---|
| **La fenêtre ouverte** | Image avec trois angles courts et un angle supérieur droit plus généreux | L'image donne accès à un moment ; elle ne flotte pas dans une card générique |
| **Le point de rencontre** | Un point décalé accompagne un trait ouvert, en reprenant le langage du logo | Il relie apparition et proximité |
| **La ligne du moment** | Date ou temporalité en une phrase, visuellement plus forte que la catégorie | On décide de sortir à partir d'un moment concret |
| **L'affiche repère** | Le marker reprend la silhouette de la fenêtre, avec une épaisseur pré-rendue | La carte et le feed appartiennent au même produit |
| **Apparaître, puis se poser** | Translation courte, opacité, arrêt net et souple | Le mouvement évoque une découverte sans agitation permanente |

### Géométrie de départ

- Fenêtre photographique : rayons `8 / 24 / 8 / 8`, à tester optiquement.
- Boutons et champs : rayon 12.
- Sheets : rayon supérieur 24.
- Avatars : cercle.
- Métadonnées : texte libre.
- Capsules : filtres sélectionnables et quelques états compacts seulement.

L'asymétrie doit rester stable et rare. Il faut éviter rotations aléatoires, coins déchirés, faux ruban adhésif, perforations de billet et autres artifices de scrapbook.

La photographie peut déborder du bloc typographique ; le texte reste aligné sur une marge constante. La séparation entre événements vient de l'espace, d'une ligne ou d'un changement de format, plutôt que d'une succession de cadres.

### Test de reconnaissance

Après une courte familiarisation, présenter sans logo des cards, un état vide et une carte géographique parmi plusieurs interfaces. Vérifier que les participants les regroupent comme un même produit et décrivent spontanément « local », « vivant » et « envie de découvrir ». La singularité est une hypothèse à tester, pas une propriété garantie par cinq tokens.

---

## G. Component-by-component redesign

### EventCard : trois architectures complémentaires

| | A. **L'affiche locale** | B. **L'instant proche** | C. **Le rendez-vous situé** |
|---|---|---|---|
| Usage principal | Accueil et découverte | Favoris et résultats denses | Aperçu cartographique |
| Architecture | Grande image, texte directement sur la page | Petite image à gauche, information temporelle en tête | Repère de lieu + image compacte + texte |
| Image | 4:3 pour une photo | Environ 88 × 104, adaptable | Environ 96 × 80 |
| Premier signal | L'image, puis le titre | La date et le titre | Le lien avec le marker sélectionné |
| Métadonnées | Une ligne temporelle, une ligne lieu/distance | Date, lieu, état utile | Lieu, date, distance |
| Catégorie | Petit libellé sans capsule | Facultative | Pictogramme ou texte court |
| Social | Une ligne discrète si pertinente | Généralement absent | Absent de l'aperçu |
| Action secondaire | Enregistrer | Retirer des favoris | Enregistrer |
| Atout | Donne envie de toucher | Permet de retrouver vite | Préserve la continuité spatiale |
| Risque | Hauteur et dépendance aux images | Moins immersive | Trop de chrome autour de la carte |
| Décision | **Architecture de référence** | **Variante nécessaire** | **Variante nécessaire** |

Exemple de hiérarchie pour l'architecture A :

```text
[               PHOTO 4:3                 ]
[                        enregistrer       ]

CE SOIR · 19 H
Le jardin passe en musique
Place des Tilleuls · Nyons · à 1,2 km

Concert
```

Exemple fictif : les formulations temporelles doivent provenir de dates fiables.

#### À retirer de la card de découverte

- le panneau systématique `DÉBUT / FIN` ;
- les vues comme badge d'attractivité par défaut ;
- la description lorsqu'elle répète le titre ;
- le bouton « Voir l'événement » lorsque toute la surface ouvre déjà le détail ;
- la multiplication des gestes sociaux dans le même aperçu ;
- la capsule de catégorie surdimensionnée lorsqu'un libellé suffit ;
- « Soyez le premier à aimer » comme appel permanent.

#### À conserver sans ambiguïté

- événement annulé ;
- événement complet ;
- contraintes d'accès importantes ;
- dates multiples ;
- information temporelle ou spatiale qui change réellement la décision.

#### Cas difficiles à spécifier dès le départ

- **Affiche verticale :** `contain`, fond uni adapté, aucun recadrage qui coupe le texte.
- **Absence d'image :** composition typographique avec pictogramme de catégorie, sans photo générique.
- **Titre long :** deux ou trois lignes selon le contexte ; croissance supplémentaire avec Dynamic Type.
- **Plusieurs jours :** « Du 12 au 14 septembre », puis précision au détail.
- **Activité récurrente :** « Plusieurs dates · Voir les prochaines séances ».
- **Période de disponibilité :** « Disponible jusqu'au 30 septembre ».
- **Horaire inconnu :** le dire ; ne pas présenter automatiquement `00:00–23:59` comme horaire de séance.
- **Distance :** préciser son mode de calcul ; ne pas convertir une distance directe en temps de marche.
- **Événement annulé enregistré :** conserver une ligne informative dans les favoris.

### Autres composants

| Composant | Décision | Redesign proposé |
|---|---|---|
| Header | **REFINE** | Réduire le bloc marque ; donner davantage de place au lieu et au contenu |
| SearchBar | **REFINE** | Une entrée simple ; détail Où/Quoi/Quand dans la surface de recherche |
| Filtres | **REFINE** | Résumé des filtres actifs ; détails dans une sheet |
| Chip | **REFINE** | Toujours distinguer information passive et choix interactif |
| Tabs | **REFINE** | Tabs soulignés pour des collections ; segmented control pour deux modes exclusifs |
| Button | **REFINE** | Texte explicite, hauteur minimale 48, rayon 12, un primaire par zone de décision |
| IconButton | **REFINE** | Symbole de 20–24 dans une cible de 48 ; fond seulement si nécessaire |
| ProfileRow | **REFINE** | Avatar, nom, ville et bouton Suivi ; densité plus utile |
| NotificationRow | **REDESIGN** | Ligne chronologique ; nom de l'événement d'abord ; lu/non lu par texte et repère |
| ContributionRow | **REDESIGN** | Titre, lieu, date d'envoi et statut ; retour en texte plutôt qu'en card imbriquée |
| Avatar | **KEEP** | Photo ou initiale ; état actif par anneau sobre |
| Badge | **REFINE** | Texte + symbole ; couleur jamais seule |
| Sheet | **REFINE** | Fond opaque clair, titre, fermeture et lignes d'action homogènes |
| Modal | **REFINE** | Réserver aux décisions qui interrompent réellement le parcours |
| Toast | **REFINE** | Retour court ; erreur durable à proximité du contenu concerné |
| Formulaire | **REFINE** | Labels persistants, aide contextualisée, erreurs près des champs |
| FAB global déplaçable | **REMOVE** de la navigation cible | Remplacer son rôle par des entrées explicites ; conserver les capacités utiles |

### Navigation basse

État observé : **Accueil / Propositions / Carte / Favoris / Profil**, cinq icônes sans libellés. Profil ouvre un drawer.

Structure cible à tester :

**Découvrir · Carte · Idées · Favoris · Profil**

- Découvrir sert l'exploration libre.
- Carte sert la recherche spatiale.
- Idées sert une sélection guidée.
- Favoris sert la récupération.
- Profil ouvre un véritable hub personnel.

L'ordre rapproche les deux modes d'exploration et conserve les usages personnels à droite. « Idées » distingue mieux les recommandations des contributions de l'utilisateur.

La barre serait fixe, sur fond Mist opaque, avec libellés permanents. L'état actif combinerait icône plus pleine, texte Ink et petit trait terminé par le point de rencontre. L'avatar convient pour Profil si son anneau est neutre hors sélection et si son libellé reste visible.

### Le « + »

| Option | Avis |
|---|---|
| FAB déplaçable | Trop de comportement et recouvre réellement le contenu sur plusieurs captures |
| FAB fixe | Acceptable uniquement si les données montrent une contribution très fréquente |
| Action centrale dans la navigation | Donne trop de poids à la production dans une Alpha de découverte |
| Geste caché | Mauvais accès principal |
| Bouton « Proposer un événement » | Le plus clair |
| Action contextuelle | Pertinente pour corriger un événement depuis son détail |

Recommandation : une entrée « Proposer un événement » dans Profil, un accès visible depuis « Mes contributions » et « Signaler une information incorrecte » au détail événement. Un rappel discret dans le feed peut être testé. Le support reste accessible depuis Profil et les états d'erreur concernés.

### Loading states

| Contexte | Concept | Comportement |
|---|---|---|
| Premier chargement du feed | Fenêtres d'affiches encore vides | Deux ou trois silhouettes aux dimensions du contenu |
| Actualisation | Contenu conservé | Petit indicateur local, aucune disparition de la liste |
| Favoris | Même structure que les favoris | Skeleton seulement si aucun contenu n'est disponible |
| Idées | Trois fragments se révèlent | Une courte séquence, puis attente calme |
| Analyse d'affiche | L'affiche choisie reste visible | Étape réelle : envoi, lecture, vérification |
| Carte | Carte maintenue | État discret des résultats ; aucun faux événement |

Remplacer la baguette par un petit arrangement de fenêtres et de points suffit. Aucun moteur graphique supplémentaire n'est nécessaire.

Pour l'analyse d'affiche, conserver les étapes réelles, mais supprimer le pourcentage pendant les phases sans mesure. Les détails « conversion », « cover » et « optimisation » n'aident pas l'utilisateur à décider.

### Empty states

Une même famille de petites scènes vectorielles : fenêtre vide, repère posé, affiche rangée. Illustration latérale ou au-dessus du texte selon l'espace, sans panneau blanc obligatoire.

| État | Texte proposé | Action |
|---|---|---|
| Aucun favori | « Vos prochaines sorties commencent ici. » | Explorer les événements |
| Aucun événement dans la zone | « Aucun événement trouvé dans cette zone. » | Élargir la recherche |
| Aucune idée correspondant aux critères | « Aucun événement ne correspond à ces critères. » | Modifier les critères |
| Aucune notification | « Vous êtes à jour. » | Aucune action obligatoire |
| Aucun profil suivi | « Retrouvez les personnes que vous suivez ici. » | Découvrir les membres |
| Aucun résultat textuel | « Aucun résultat pour “…” » | Modifier la recherche |
| Aucune contribution | « Vos propositions et corrections apparaîtront ici. » | Proposer un événement |

Erreur réseau, permission refusée et zéro résultat doivent conserver des traitements distincts.

### Content Design System

Le **vouvoiement** est recommandé. Il convient à une marque locale large et adulte. Les boutons peuvent exprimer l'action de l'utilisateur : « Je note la date » n'est pas une incohérence avec « Retrouvez vos favoris ».

| Actuel | Proposition |
|---|---|
| Pour vous | Autour de vous, tant que la sélection n'est pas réellement personnalisée |
| On prépare tes propositions | Nous cherchons des idées autour de vous |
| Roulement de tambour… | Supprimer |
| Nous préparons vos favoris | Chargement de vos favoris, uniquement si un texte est utile |
| Encore un instant, vos pépites arrivent… | Supprimer |
| Proposer depuis une affiche | Proposer un événement |
| tu vérifies avant de publier | Vérifiez les informations avant l'envoi |
| Mes suggestions | Mes contributions |
| Historique des propositions de découverte | Historique des idées |
| Tu y vas | Événement prévu, si cela correspond bien à l'état enregistré |
| Rechercher vos pépites enregistrées, onglet Suivis | Rechercher une personne |
| Vider les suivis | Retirer tous mes suivis, dans un menu secondaire avec confirmation |
| Déjà passé | La date de cet événement est déjà passée |
| Connexion biométrique | Se reconnecter, accompagné de Face ID ou Touch ID lorsque disponible |

Glossaire proposé :

- **Idées :** recommandations proposées à l'utilisateur.
- **Contributions :** événements envoyés, corrections et doublons signalés.
- **Favoris :** événements enregistrés pour les retrouver.
- **Aimer :** signal social.
- **Suivre :** relation avec une personne.

Leur éventuel couplage doit être décidé et expliqué avant toute modification fonctionnelle.

---

## H. Iconography system

### Moments Locaux Icon System — contour ouvert, point de rencontre

Spécification de départ :

- grille de 24 × 24 ;
- trait optique proche de 1,8–2 ;
- terminaisons arrondies ;
- ouverture de contour sur les icônes de marque ;
- point décentré de 3 unités lorsque sa présence reste lisible ;
- petit rayonnement dérivé du logo pour signaler une apparition, jamais comme décoration systématique ;
- états actifs utilisant une petite zone pleine ;
- variante simplifiée pour les petites métadonnées.

Le point ne doit pas ressembler à un badge non lu. Les notifications utilisent un emplacement et une taille distincts.

| Fonction | Construction proposée | Technologie |
|---|---|---|
| Découvrir | Fenêtre ouverte avec point apparaissant | SVG propriétaire via `react-native-svg` |
| Idées | Deux fenêtres décalées ou chemin lié | SVG propriétaire |
| Carte | Plan plié simplifié avec repère | SVG propriétaire |
| Favoris | Signet ouvert si l'enregistrement est séparé du like | SVG propriétaire |
| Profil | Avatar ; silhouette simple en fallback | Image + primitive / SVG |
| Notifications | Cloche conventionnelle légèrement harmonisée | SVG |
| Proposer | Petite affiche accompagnée d'un plus | SVG propriétaire |
| Lieu | Repère condensé de la famille cartographique | SVG |
| Distance | Segment entre deux points | SVG simple |
| Date | Calendrier très lisible | SVG conventionnel harmonisé |
| Heure | Horloge | SVG simple |
| Suivre | Personne + plus, puis coche | SVG |
| Aimer | Cœur, contour puis plein | SVG + Reanimated |
| Catégories | Famille limitée de silhouettes distinctes | SVG ; export raster pour Mapbox |
| Séparateurs, points, coches | Formes élémentaires | Primitives React Native |

Ne pas créer de nouvelle icon font propriétaire. Elle ajouterait une chaîne d'export et une gestion typographique sans avantage clair. Lottie ou Rive ne sont pas nécessaires pour les icônes usuelles. La 3D reste réservée aux repères et à quelques illustrations.

Les fonctions universelles comme retour, fermeture ou partage doivent conserver leur lisibilité conventionnelle. La personnalité se concentre sur les signes à forte fréquence et forte valeur de marque.

---

## I. Map experience

### Proposition : un quartier ponctué de petites affiches qui indiquent où regarder

La carte doit conserver les rues, les noms de lieux et les repères d'orientation. Le fond peut être adouci ; il ne doit pas devenir une illustration verte où toute information géographique se confond.

| Niveau | Affichage |
|---|---|
| Vue large | Clusters compacts avec nombre |
| Quartier | Repères simplifiés, collisions gérées |
| Rue | Silhouette 2,5D et pictogramme reconnaissable |
| Sélection | Repère légèrement agrandi + aperçu stable |
| Plusieurs événements au même lieu | Nombre et liste locale ; aucune dispersion aléatoire des coordonnées |

### Encodage des états

- **Sélectionné :** taille et contraste.
- **En cours :** petit signe temporel accompagné de « En cours » dans l'aperçu.
- **Enregistré :** marque discrète dédiée.
- **Aimé par vos suivis :** information dans l'aperçu, sans suggérer un suivi de créateur.
- **Éphémère :** fin indiquée lorsqu'elle est connue.
- **Populaire :** expérimentation ultérieure, avec définition explicite ; aucun agrandissement automatique fondé sur un compteur de vues.
- **Nouveau résultat :** apparition courte après stabilisation de la carte, sans animation permanente.

Limiter le cumul à un marker principal et un qualificatif secondaire.

### Direction 2,5D recommandée

Commencer par une mini-affiche épaisse, plutôt que par une collection entière d'objets hétérogènes. Elle reprend la fenêtre asymétrique du feed.

1. Modèle maître Blender.
2. Caméra orthographique commune, angle trois quarts peu prononcé.
3. Matière mate, sans aspect plastique « jouet ».
4. Lumière douce toujours orientée de la même façon.
5. Six à huit déclinaisons couvrant les grandes familles de catégories.
6. Export transparent à la taille réellement affichée.
7. Versions simplifiées pour faible zoom et sélection.

Une guitare miniature ou un panier de marché peuvent être comparés au modèle « affiche ». Si l'objet est moins lisible à 32–40 points, il reste une illustration d'état vide plutôt qu'un marker.

### Comparaison technique

Les efforts sont des estimations pour un prototype ciblé, hors généralisation et QA complète. Aucun FPS n'a été mesuré.

| Solution | GPU / mémoire | Poids ajouté | iOS / Android | Effort et maintenance | Décision |
|---|---|---|---|---|---|
| SVG statique puis image Mapbox | Faible coût récurrent ; atlas borné | Faible | Chaîne actuelle à conserver | 2–4 jours ; faible | **Socle** |
| Blender pré-rendu PNG/WebP | Coût de sprites et textures, sans calcul 3D | Assets uniquement | PNG d'abord ; valider WebP dans le chemin Mapbox | 5–10 jours avec DA ; modéré | **Prototype prioritaire** |
| Rive | Rendu actif selon complexité ; runtime natif | Runtime + fichiers | Runtime RN disponible ; compatibilité précise à vérifier | 4–8 jours ; dépendance éditeur/runtime | **Réserver à une scène interactive justifiée** |
| Lottie | Coût variable selon paths, masques et instances | Runtime + animations | Validation sur les deux plateformes | 3–6 jours ; modéré | **Option pour une animation isolée** |
| Skia | Canvas GPU ; coût dépendant des dessins et effets | Module natif supplémentaire | Version à aligner avec Expo/RN | 4–8 jours ; code spécialisé | **Seulement si SVG/Reanimated limitent un besoin réel** |
| Spline runtime | Scène, textures, moteur et couche d'intégration | Plus important qu'un sprite | Parité React Native à démontrer | 5–10 jours de faisabilité | **Outil d'exploration, pas fondation Alpha** |
| Three.js / React Three Fiber | Rendu 3D continu, contexte graphique, textures | Moteur + assets + intégration | Chemin RN possible, validation native nécessaire | 10–20 jours de prototype | **Écarter du cœur de découverte** |
| WebGL dans une WebView | Cumul moteur web, carte et coordination des gestes | Runtime web et scène | Deux plateformes à valider | Maintenance élevée | **Écarter** |

### Intégration Mapbox

Conserver la chaîne `Images → ShapeSource → SymbolLayer`. Les repères statiques conviennent à ce rendu ; la documentation Mapbox recommande les images ou `SymbolLayer` pour éviter le coût de nombreuses vues interactives : [documentation MarkerView](https://rnmapbox.github.io/docs/components/MarkerView).

- Images enregistrées une fois, pas recréées à chaque mouvement.
- Identifiants stables.
- Ancrage géographique au pied du repère.
- Aucun appel React par frame pour animer chaque événement.
- Clusters lisibles indépendamment des catégories.
- Tests des événements superposés entre catégories.
- Conservation du `LocationPuck` natif.
- Attribution Mapbox et contrôles légaux toujours visibles.

Un halo de rayon peut aider pendant le réglage d'une recherche, avec une légende. Il ne doit pas devenir une pulsation permanente autour de chaque événement ni réintroduire le halo de sélection déjà exclu par la charte actuelle.

Une liste accessible synchronisée avec la zone doit proposer les mêmes résultats. Une carte native riche ne remplace pas une interface structurée pour VoiceOver et TalkBack.

---

## J. Motion system

Le vocabulaire tient en trois verbes : **apparaître, se poser, confirmer**.

| Interaction | Valeur de départ | Technologie | Réduction des mouvements |
|---|---|---|---|
| Pression sur card | Scale `1 → 0,985`, 100–120 ms | Reanimated | Changement de couleur |
| Pression sur bouton | Retour visuel immédiat, 80–120 ms | Pressable / Reanimated | Même retour sans déplacement |
| Enregistrer / aimer | Scale maximal 1,08–1,12, retour en 160–200 ms | SVG + Reanimated | Changement plein/contour |
| Suivre | Remplacement du plus par une coche, 140 ms | SVG + Reanimated | Remplacement immédiat |
| Premier contenu | Opacité + translation de 6–8 points, 180–220 ms | Reanimated | Apparition immédiate |
| Stagger | 25–35 ms, quatre éléments maximum | Reanimated | Aucun délai |
| Navigation | Transition native, environ 220–300 ms si configurable | Native stack | Comportement système |
| Sheet | 260–320 ms ou spring amorti | Gesture Handler + Reanimated | Transition minimale |
| Marker sélectionné | Scale `1 → 1,08`, 160–200 ms | Style Mapbox validé | Changement immédiat |
| Retour réussi de contribution | Coche, 180 ms | SVG + Reanimated | Coche statique |
| Notification reçue | Badge actualisé, aucun déplacement du contenu lu | État natif / RN | Identique |
| Localisation obtenue | Recentrage unique après action explicite | Caméra native | Déplacement réduit ou immédiat |
| Refus / erreur | Aucun rebond ni secousse | Texte et état | Identique |
| Card → détail avec image partagée | Prototype 280–340 ms | À isoler | Transition native simple |

Spring de départ pour un panneau : `damping: 24`, `stiffness: 220`, `mass: 1`, à ajuster sur appareil.

Règles transversales :

- ne pas rejouer les animations à chaque retour dans une liste ;
- ne pas animer tous les résultats après un déplacement cartographique ;
- arrêter les boucles lorsque l'écran perd le focus ;
- ne pas différer l'accès au contenu pour terminer une séquence de marque ;
- haptique légère uniquement après une action pertinente ;
- respecter `useReduceMotion` sur toutes les branches, y compris le loader des propositions ;
- réduire le token global `pressScale: 0.94`, trop fort pour de grandes surfaces ;
- réduire le cœur qui monte actuellement à 1,3.

Les transitions partagées de Reanimated restent expérimentales et ne doivent pas conditionner la livraison : [documentation officielle](https://docs.swmansion.com/react-native-reanimated/docs/category/shared-element-transitions/).

---

## K. Typography & spacing

### Typographie

Une seule famille pour commencer : **Plus Jakarta Sans**. Elle est déjà intégrée en 400, 500, 600 et 700. Son utilisation dans un logiciel commercial est compatible avec sa licence OFL, en conservant les notices requises : [licence du projet](https://raw.githubusercontent.com/tokotype/PlusJakartaSans/master/OFL.txt).

La priorité est de l'appliquer réellement partout. Une seconde famille display ne serait étudiée qu'après comparaison sur les vrais contenus.

| Rôle | Taille / interligne proposés | Graisse | Usage |
|---|---:|---:|---|
| Display | 34 / 40 | 700 | Une accroche ponctuelle |
| Titre écran | 28 / 34 | 600 | Nom du lieu ou de l'écran |
| Titre section | 22 / 28 | 600 | Découpage éditorial |
| Titre EventCard | 23 / 29 | 600 | Événement au premier plan |
| Titre compact | 18 / 24 | 600 | Favoris et résultats |
| Body | 16 / 24 | 400 | Description et formulaires |
| Metadata | 14 / 20 | 500 | Date, lieu, distance |
| Label | 14 / 18 | 600 | Contrôles |
| Badge | 12 / 16 | 600 | État court non essentiel à lui seul |
| Chiffres / dates | 14–16 / 20–22 | 500–600 | Alignement tabulaire si supporté |

Principes :

- mettre le titre en valeur par sa largeur et son espace, pas uniquement par le gras ;
- réserver les capitales aux très courts repères ;
- composer les horaires comme une phrase ;
- garder le texte secondaire lisible ;
- utiliser explicitement les fichiers de fontes correspondant aux poids, sans dépendre d'un 800 synthétique ;
- préserver les noms propres saisis ou importés, plutôt que leur imposer une capitalisation arbitraire.

### Espacement

Échelle : `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Relation | Valeur de départ |
|---|---:|
| Icône → texte | 6–8 |
| Métadonnées d'un même groupe | 4–8 |
| Titre → lieu | 8 |
| Image → bloc texte | 12 |
| Deux contrôles | 12 |
| Marges écran | 20 |
| Deux événements | 28–32 |
| Deux sections | 40–48 |

Le rythme vient de relations différentes. Une séquence de trois cards identiques ne doit pas recevoir des espacements aléatoires pour paraître humaine.

### Accessibilité

- Cibles de 48 × 48 unités logiques.
- Agrandissement du texte sans couper l'action principale.
- Passage des compositions côte à côte en pile lorsque nécessaire.
- Ordre de lecture équivalent à la hiérarchie visuelle.
- Nom, rôle et état annoncés pour les commandes.
- Focus déplacé correctement dans les sheets, puis rendu à leur déclencheur.
- Boutons explicites en alternative au swipe.
- Aucun état distingué uniquement en rouge et vert.
- Aucun texte essentiel directement sur une photo imprévisible.
- Vérifications VoiceOver et TalkBack sur appareils réels.

---

## L. React Native implementation recommendations

Le dépôt déclare Expo 54, React Native 0.81.5, Reanimated 4.1, Gesture Handler 2.28 et `react-native-svg` 15.12. `expo-image`, FlashList, Skia, Rive et Lottie ne figurent pas parmi les dépendances directes consultées au moment de l'audit.

La première vague peut être construite avec la stack existante. Expo Image peut être évalué pour les médias : cache, redimensionnement, placeholders et recyclage sont documentés pour le SDK utilisé. Référence : [Expo Image SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/image/).

### Quatorze composants structurants

Les noms décrivent des cibles et ne signifient pas que les composants sont déjà implémentés.

| Composant | Design / implémentation | Animation | Performance | Accessibilité |
|---|---|---|---|---|
| `EventCardV2` | Photo 4:3, titre sur la page, métadonnées en lignes ; Pressable + image optimisée | Scale 0,985 / 120 ms | Props stables, mémoïsation utile, pas de carrousel monté partout | Lien principal regroupé ; action Enregistrer comme cible sœur |
| `EventMedia` | Variantes photo `cover`, affiche `contain`, fallback typographique | Fondu 120 ms si pertinent | Dimensions adaptées, recyclage et cache maîtrisés | Image décorative si le texte adjacent fournit l'information |
| `MomentLine` | Phrase temporelle calculée hors rendu visuel | Aucune | Calcul partagé, pas de timer par card | Date complète dans le libellé accessible |
| `SaveButton` | Signet ou cœur selon décision sémantique | Confirmation 160–200 ms | Aucun rechargement global de liste | État sélectionné et libellé explicite ; cible 48 |
| `ProfileRow` | Avatar 40–48, identité, action de suivi | Coche 140 ms | Liste virtualisée | Profil et Suivre exposés séparément |
| `NotificationRow` | Ligne chronologique, repère non lu | Changement discret d'état | Mise à jour de la ligne concernée | Auteur, événement, date et état lisibles |
| `ContributionRow` | Titre, lieu, envoi, statut et retour | Apparition simple | Pas de card imbriquée | État et retour annoncés dans l'ordre |
| `DiscoveryHeader` | Lieu, titre et recherche ; quelques actions | Réduction éventuelle après prototype | Aucun recalcul lourd lié au scroll | Titres conservés ; ordre de focus stable |
| `BottomNavV2` | Cinq entrées fixes, libellés, avatar | Actif 120–160 ms | Aucun flou de fond | Rôle onglet, état sélectionné, libellés complets |
| `ContributionEntry` | Bouton « Proposer un événement » | Feedback de pression | Primitive légère | Aucun geste requis pour le retrouver |
| `ActionSheet` | Fond opaque, titre et lignes d'action communes | Spring amorti | Éviter les panneaux imbriqués | Focus captif, fermeture explicite, retour du focus |
| `DiscoveryLoading` | Silhouettes d'affiches adaptées au contenu | Séquence courte, puis calme | Deux ou trois éléments animés au maximum | Un seul état de chargement annoncé |
| `BrandEmptyState` | Scène SVG simple + texte + action | Apparition facultative 180 ms | SVG statique, sans moteur ajouté | Illustration décorative ; action directement accessible |
| `PosterAnalysisState` | Affiche visible + étape réelle + accès au formulaire | Transition entre étapes 180 ms | Aucun rendu toutes les 200 ms pour un faux pourcentage | Annonce à chaque étape réelle, pas à chaque tick |
| `MapMomentMarker` + `MapPreview` | Sprite commun, aperçu photo compact | Sélection 160–200 ms | Atlas borné, SymbolLayer ; aperçu RN unique | Résultat équivalent dans la liste et bouton détail |

Rendre toute une card accessible comme un seul élément tout en imbriquant des commandes peut masquer ces commandes aux lecteurs d'écran. La cible principale et l'action secondaire doivent être structurées et testées comme deux éléments accessibles distincts.

### Budget de performance

Ces valeurs sont des critères de validation, pas des performances garanties.

- Objectif principal : défilement et gestes fluides à 60 Hz sur Android milieu de gamme.
- Budget théorique : 16,67 ms à 60 Hz ; 8,33 ms à 120 Hz.
- Le 120 Hz reste conditionnel selon écran, plateforme et pipeline.
- Mesurer le temps des frames, les images perdues, la mémoire et la latence d'interaction.
- Profiler en build release : le mode développement fausse l'évaluation.

| Point sensible | Prescription |
|---|---|
| JS thread | Pas de filtrage lourd, calcul de dates ou transformation GeoJSON à chaque frame |
| UI thread | Animations courtes ; éviter les changements de layout sur beaucoup de cellules |
| Overdraw | Retirer les empilements page + card + gradient + voile lorsqu'ils sont inutiles |
| Blur | Aucun flou permanent derrière la navigation ou sur chaque card |
| Shadows | Une élévation utile ; aucune grande ombre diffuse par événement |
| Images | Servir la résolution nécessaire ; limiter les préchargements |
| SVG | Peu de paths et de masques ; rasteriser les familles cartographiques |
| Markers | SymbolLayer, collisions, clusters ; limiter les annotations interactives |
| Listes | Conserver FlatList tant que les mesures sont bonnes ; FlashList seulement si nécessaire |
| Recyclage | Réinitialiser correctement image et état de chaque cellule |
| 3D | Assets pré-rendus ; pas de boucle de rendu 3D |
| Animations simultanées | Un centre d'attention ; arrêter les éléments hors écran |

Une image RGBA de 1 200 × 900 représente environ 4,12 Mio décodés, même si son poids WebP sur disque est faible. Un atlas RGBA de 1 024 × 1 024 représente environ 4 Mio, hors copies et surcoûts éventuels. La taille compressée ne suffit pas à piloter la mémoire.

Scénarios de validation : longue liste paginée, défilement avec médias hétérogènes, carte dense avec plusieurs catégories au même point, changement de filtres, ouverture/fermeture répétée du détail, réseau lent, texte agrandi et réduction des mouvements.

---

## M. Design System v2

### Fondations de couleur

| Token | Valeur proposée | Rôle |
|---|---|---|
| `brand.mist` | `#F4FBF6` | Couleur identitaire |
| `brand.forest` | `#1A3329` | Couleur identitaire |
| `brand.lime` | `#7CB518` | Couleur identitaire |
| `brand.berry` | `#E63946` | Accent identitaire |
| `surface` | `#F4FBF6` | Page |
| `surface-raised` | `#FFFFFF` | Petites surfaces élevées |
| `surface-subtle` | `#E8F5E9` | Regroupement doux |
| `ink-primary` | `#1A3329` | Texte principal |
| `ink-secondary` | `#4A6556` | Texte secondaire plus robuste |
| `border-subtle` | `#D5E6DA` | Séparation décorative |
| `border-control` | `#5B7A6A` | Limite fonctionnelle lorsque nécessaire |
| `lime-primary` | `#7CB518` | Action principale |
| `lime-hover` | `#82BC1D` | Pointeur, si plateforme concernée |
| `lime-pressed` | `#73AA16` | Pression |
| `on-lime` | `#1A3329` | Texte et icône sur lime |
| `berry` | `#E63946` | Accent ponctuel |
| `success-ink` | `#315C3D` | Texte de confirmation |
| `warning-ink` | `#785015` | Texte d'attention |
| `error-ink` | `#B92332` | Erreur textuelle |
| `info-ink` | `#285A70` | Information neutre |
| `map-land` | `#EFF4EC` | Base cartographique candidate |
| `map-water` | `#D8E9E5` | Eau |
| `map-label` | `#3F594B` | Libellés |
| `overlay-scrim` | `rgba(26,51,41,0.40)` | Fond de modal |
| `overlay-photo` | Gradient local dédié | Protection d'un texte sur image |

Les tokens fonctionnels doivent posséder leur fond et leur premier plan associés. Leur présence dans ce tableau ne vaut pas validation de toutes les combinaisons.

### Contrastes calculés sur les aplats

| Premier plan / fond | Ratio | Conclusion |
|---|---:|---|
| Forest / Mist | 12,89:1 | Très bon |
| Forest / Lime | 5,47:1 | Convient au texte courant |
| Blanc / Lime | 2,48:1 | À écarter, même pour un grand texte AA |
| Lime / Mist | 2,36:1 | À écarter pour le texte et les signes essentiels |
| Secondaire actuel `#5B7A6A` / Mist | 4,502:1 | Passe de justesse |
| Secondaire actuel / Soft green | 4,21:1 | Insuffisant pour le texte courant |
| Secondaire proposé `#4A6556` / Soft green | 5,68:1 | Plus robuste |
| Berry / Mist | 3,96:1 | Insuffisant pour du petit texte |
| Blanc / Berry | 4,17:1 | Insuffisant pour du texte courant |
| Error ink / Mist | 5,96:1 | Convient au texte courant |
| Forest / Lime pressed proposé | 4,83:1 | Convient au texte courant |

Le référentiel WCAG fixe notamment 4,5:1 pour le texte courant et 3:1 pour le grand texte, avec des exigences spécifiques pour les informations non textuelles. Les contrastes sur photos et transparences doivent être évalués sur le rendu final : [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

### Dark mode potentiel

Préparer des rôles sémantiques, sans inverser automatiquement les valeurs :

- page candidate `#10241B` ;
- surface élevée candidate `#19352A` ;
- texte principal Mist ;
- Lime conservé comme accent ;
- palette cartographique dédiée.

Ce serait une validation distincte incluant photos, états, markers et contrastes. Il ne doit pas revenir implicitement par les anciennes règles de `DESIGN.md`.

### Profondeur

| Niveau | Usage | Traitement |
|---|---|---|
| 0 | Page, feed, lignes | Aucune ombre |
| 1 | Action sur photo, contrôle cartographique | Fond opaque et ombre courte si nécessaire |
| 2 | Aperçu sélectionné | Superposition claire |
| 3 | Sheet / modal | Scrim et élévation propre à la plateforme |

La profondeur vient d'abord de la superposition. Le flou n'est pas une fondation du système.

### Architecture du système

| Couche | Contenu |
|---|---|
| Foundations | Couleurs, typographie, espace, géométrie, élévation, opacité, iconographie, motion |
| Primitives | `Surface`, `Stack`, `Text`, `Icon`, `Avatar`, `Badge` |
| Components | Button, IconButton, Chip, FilterChip, SearchBar, Card, EventCard, ProfileRow, NotificationRow, ContributionRow, Tabs, BottomNav, Sheet, Modal, Toast, EmptyState, LoadingState, MapMarker |
| Patterns | Discovery feed, Event detail, Favorites, Map exploration, Search, contribution depuis une affiche, Profile, Notifications |
| Content | Voix, glossaire, dates, pluriels, erreurs, permissions, états de contribution |

Contrats à formaliser :

- `Surface` ne crée pas automatiquement bordure et ombre ;
- `Card` reste une primitive rare, pas un emballage obligatoire ;
- `Text` impose une variante sémantique ;
- `Badge` reçoit un état, pas une couleur arbitraire ;
- `Icon` reçoit un nom du registre ;
- Motion expose des comportements nommés, avec variante réduite ;
- chaque composant documente chargement, vide, erreur, désactivé et texte agrandi ;
- les assets conservent leur source, leurs exports, leur taille prévue et leur licence.

La checklist `docs/CHARTER_UI_SURFACES.md` doit rester le registre de couverture pendant la migration : sheets, boutons, loaders, carte, propositions, onboarding, Lumia et contributions.

---

## N. Screen-by-screen audit

Cette section intègre les constats des dix captures iOS fournies. Les notes sont des estimations de triage : 10 représente l'impact, le problème ou l'effort maximal.

### 1. Proposer depuis une affiche

**Ce qui fonctionne :** les trois possibilités sont compréhensibles, les actions principales sont grandes et le fond uni laisse respirer le contenu.

**Constats :**

- « Depuis une affiche » puis « Proposer depuis une affiche » répètent la même information.
- L'icône Sparkles précède un titre massif : l'attention va à la technologie et au discours.
- Aucune affiche n'est représentée. Le sujet concret du parcours reste absent.
- Les deux grands boutons donnent presque autant de poids à deux moyens d'accomplir la même tâche.
- Le texte blanc du bouton principal et le lime du bouton secondaire manquent de contraste.
- « Tu vérifies avant de publier » mélange le tutoiement et laisse entendre une publication directe, alors que l'élément passe ensuite en validation.
- La moitié inférieure vide n'est pas un défaut en soi ; il serait inutile de la remplir de décoration.

**Composition proposée :**

```text
‹ Proposer un événement

Une affiche à partager ?
Ajoutez-la : nous préremplissons les informations.
Vous pourrez les vérifier avant l'envoi.

[Petit exemple d'affiche, clairement illustratif]

[ Photographier une affiche ]
[ Choisir une image ]

Saisir les informations
```

Après import, l'affiche de l'utilisateur devient le visuel principal et reste visible pendant l'analyse.

**Décision : REFINE.** Impact 7/10 · esthétique 6/10 · UX 6/10 · effort 3/10.

### 2. Mes suggestions

Cet écran confirme nettement l'impression de fiche administrative.

L'œil rencontre successivement l'introduction, le quota, les filtres, la nature de contribution, le statut, puis enfin le titre. Le contenu qui permet de reconnaître sa contribution arrive trop tard.

- Chaque card répète « ÉVÉNEMENT SUGGÉRÉ » alors que les items visibles sont du même type.
- Les grands rectangles blancs donnent la même importance à tous les éléments.
- Le statut est correctement exprimé par du texte : à conserver.
- Les dates ne précisent pas s'il s'agit de l'envoi ou de l'événement.
- La card refusée contient une nouvelle card rouge : deux niveaux d'encadrement pour une seule explication.
- « Déjà passé » est compréhensible, mais abrupt.
- Les titres en capitales et en casse normale alternent. Cela peut venir des données ; il faut préserver les noms propres.
- Le filtre partiellement visible à droite suggère un défilement horizontal ; son affordance doit être vérifiée.

**Structure proposée :**

```text
Soirée Cowboy
Ambleteuse · Envoyé le 7 septembre
◷ En cours de validation
────────────────────────────────

Soirée Cowboy
Nyons · Envoyé le 7 septembre
Non retenu
La date de cet événement est déjà passée.
```

Le type devient une petite métadonnée utile dans la vue « Tous ». Le quota se rapproche des actions de correction et gagne en importance seulement lorsque la limite approche.

**Décision : REDESIGN de la liste.** Impact 7/10 · esthétique 7/10 · UX 6/10 · effort 4/10.

### 3. Notifications

La hiérarchie est inversée. « Événement à venir » domine, tandis que « La Rando des 4 Mines », l'information qui distingue une notification de la suivante, est secondaire.

Les trois niveaux « Événement à venir / nom / Rappel » disent peu de choses différentes.

- Mettre le nom de l'événement en premier.
- Donner ensuite l'information qui motive le rappel : date, heure ou échéance réellement connue.
- Reléguer la date de réception au dernier niveau.
- Employer des lignes séparées plutôt que de grandes cards autonomes.
- Distinguer les notifications non lues sans dépendre uniquement du fond.
- Clarifier l'état de « Tout lire », dont le faible contraste fait hésiter entre action disponible et action désactivée.
- Pour « Photo refusée », afficher le motif lorsque celui-ci est disponible.

Exemple :

```text
La Rando des 4 Mines
Rappel de votre événement enregistré
Reçu il y a 3 jours
```

**Décision : REDESIGN des lignes, KEEP des filtres.** Impact 7/10 · esthétique 8/10 · UX 7/10 · effort 3/10.

### 4. Menu latéral / profil

Le drawer est lisible et ses groupes sont visibles, mais il porte trop de décisions d'architecture.

- « Membres » et « Ma communauté » utilisent la même icône et ne rendent pas leur différence évidente.
- « Mon profil » paraît sélectionné alors que l'écran derrière semble être Favoris.
- L'adresse e-mail prend une place importante sans aider à choisir une destination.
- « Ajouter un événement », « Mes suggestions » et les autres entrées emploient plusieurs vocabulaires.
- Déconnexion est l'une des surfaces les plus contrastées et les plus grandes.
- L'espacement allonge fortement la navigation.

Le futur onglet Profil devrait devenir un hub personnel : Mes contributions, Personnes suivies, Découvrir les membres, Proposer un événement, Paramètres et aide. La déconnexion peut devenir une ligne secondaire clairement accessible.

**Décision : REFINE immédiatement ; REDESIGN de l'architecture ensuite.** Impact 8/10 · esthétique 6/10 · UX 8/10 · effort 5/10.

### 5. Favoris — profils suivis

La structure avatar + nom + ville fonctionne et doit être conservée. Le problème réel est l'espace excessif et la sémantique des commandes.

- Le titre, la recherche et le sélecteur repoussent largement la première personne.
- La recherche parle de « pépites enregistrées » dans une liste de personnes.
- Les cœurs verts sur disques gris ressemblent à une autre génération de composants.
- Un cœur signifie plutôt « aimer » qu'« être abonné ».
- « Vider les suivis » expose une action globale de retrait comme commande courante.
- « Utilisateur supprimé » conserve un cœur actif sans expliquer ce que cette action permet.
- Le FAB recouvre visuellement la commande de la dernière ligne.

Proposition : recherche « Rechercher une personne », lignes plus compactes capables de grandir avec le texte, bouton « Suivi ✓ », retrait global dans un menu secondaire, état spécifique permettant de retirer un compte supprimé.

À terme, les personnes suivies peuvent rejoindre Profil / Membres afin que Favoris redevienne une collection d'événements.

**Décision : REFINE prioritaire.** Impact 7/10 · esthétique 7/10 · UX 8/10 · effort 3/10.

### 6. Favoris — événements

Presque toute la moitié supérieure est occupée par les outils : titre, recherche, type de collection, période, compteur, tri et suppression. Une seule card complète trouve place avant la navigation.

La card contient une capsule de catégorie, un cœur, un titre, une description, un lieu souligné, une distance, une colonne `DÉBUT / FIN`, une preuve sociale et le FAB superposé.

Pour retrouver un événement déjà enregistré, cette densité est mal distribuée. Utiliser la variante compacte, avec une image plus petite et davantage de place au titre et au moment utile.

Le cas montré demande une règle spécifique : un jeu de piste disponible du 15 juillet au 30 septembre n'a pas besoin de présenter `00:00` et `23:59` comme horaires de sortie si ces valeurs représentent seulement les bornes de disponibilité.

```text
Jeu de piste — Le roi est mort !
Rodemack · 9,5 km
Jusqu'au 30 septembre
Voir les conditions et horaires
```

Conserver les horaires précis lorsqu'ils correspondent réellement à une séance.

**Décision : REDESIGN prioritaire.** Impact 9/10 · esthétique 7/10 · UX 8/10 · effort 5/10.

### 7. Chargement des favoris

Le logo est le meilleur élément de cet état et appartient réellement à Moments Locaux. Le panneau blanc centré occupe toutefois une grande surface pour annoncer le chargement d'une collection connue. « Nous préparons » et « vos pépites arrivent » ajoutent une mise en scène sans repère utile.

La navigation et le FAB restent visibles, tandis que le contenu de Favoris disparaît entièrement.

- Premier chargement : structure de favoris avec quelques silhouettes.
- Actualisation : conserver les éléments disponibles.
- Attente prolongée : message bref dans la liste.
- Réserver le logo animé à un démarrage ou une transition globale.

**Décision : REMOVE du panneau pour ce cas ; KEEP du logo.** Impact 6/10 · esthétique 7/10 · UX 6/10 · effort 2/10.

### 8. Chargement des propositions

C'est l'écran le plus fortement associé aux conventions visuelles d'une fonctionnalité IA : baguette magique surdimensionnée, grand cercle, slogan en capitales, titre centré, promesse des « meilleurs événements » et trois points d'attente.

Ces signes répètent tous la même information.

```text
Des idées autour de vous

[Deux ou trois fenêtres d'événements se révèlent]

Recherche selon vos critères…
```

Le mouvement vient des fenêtres et reprend le trait de liaison du logo. « Les meilleurs » disparaît : la sélection peut correspondre à des critères sans prétendre établir une qualité absolue.

**Décision : REDESIGN.** Impact 6/10 · esthétique 9/10 · UX 5/10 · effort 2/10.

### 9. Accueil / feed

L'image possède déjà une vraie force d'attraction. Le feed ne doit pas devenir uniquement une liste compacte.

Le header multiplie les signes : avatar, salutation, nom de marque, deux disques d'action, recherche avec ombre, titre et tri. Le disque blanc à gauche de la cloche paraît vide sur la capture ; son contenu et son chargement doivent être vérifiés.

La card comprime le titre pour préserver les métadonnées. « Ateliers Danse et Mouvement mus… » est tronqué alors qu'une colonne entière détaille une année de disponibilité.

Le risque UX le plus important des captures est la relation entre « Aujourd'hui » et un événement du 1er janvier au 31 décembre. Il faut distinguer :

| Nature de l'information | Présentation attendue |
|---|---|
| Séance datée | Aujourd'hui · 18 h |
| Activité récurrente | Plusieurs dates · Voir les prochaines séances |
| Disponibilité sur une période | Disponible jusqu'au… |
| Horaires non précisés | Horaires à vérifier |

Cette distinction doit respecter les données effectivement disponibles.

Autres constats :

- la capsule « FAMILLE & ENFANTS » concurrence l'image et le titre ;
- « Soyez le premier à aimer » transforme une absence d'interaction en appel social permanent ;
- le FAB masque une partie de l'image suivante ;
- le cadrage très serré de la photographie mérite un point focal adapté ;
- « Pour vous » doit être réservé à une sélection réellement personnalisée.

**Décision : REDESIGN de la card et REFINE du header ; vérification temporelle en premier.** Impact 10/10 · esthétique 7/10 · UX 9/10 · effort 6/10.

### 10. Authentification

Cet écran est plus immersif que les autres, mais il exprime surtout le calme, la nature et le bien-être. La lumière diffuse, le groupe assis dans l'herbe et les panneaux translucides peuvent évoquer une application de méditation ou de sorties douces.

**Ce qui fonctionne :** logo et marque immédiatement reconnaissables, reconnexion prioritaire, alternatives disponibles et accès invité présent.

**Ce qui affaiblit l'expérience :**

- cinq grands boutons empilés donnent une composition répétitive ;
- la biométrie est formulée dans un vocabulaire technique ;
- le voile lumineux réduit la présence de la scène photographique ;
- « ou continuer avec » repose sur une zone photographique claire et variable ;
- connexion connue, alternatives et création de compte occupent presque tout l'écran.

Pour un utilisateur connu, proposer « Se reconnecter », accompagné de Face ID ou Touch ID lorsque disponible, puis une alternative par mot de passe. Les autres modes rejoignent une zone secondaire. Pour un nouvel utilisateur, adapter la composition à l'inscription. La photographie devient plus documentaire : scène culturelle, marché, atelier ou lieu habité, avec un traitement commun.

**Décision : REFINE.** Impact 9/10 · esthétique 6/10 · UX 6/10 · effort 4/10.

### Autres écrans audités depuis le code

| Écran | Diagnostic | Décision | I / E / U / D | Priorité |
|---|---|---|---:|---:|
| Carte / recherche | Base technique solide, markers encore fondés sur le pin et la catégorie. Priorité à la clarté recherche → sélection → aperçu, puis sprites distinctifs. | KEEP + EXPERIMENT | 10 / 7 / 6 / 8 | 1 pour UX ; 3 pour 2,5D |
| Détail événement | Vérifier l'ordre : comprendre, décider, s'y rendre, enregistrer, contribuer. Donner aux actions secondaires une place proportionnée. | REFINE | 10 / 6 / 7 / 6 | 1 |
| Inscription | Composants partagés déjà présents. Harmoniser avec la connexion, garder labels et erreurs visibles avec clavier et texte agrandi. | REFINE | 9 / 4 / 6 / 3 | 1 |
| Historique des idées | Empilement de sessions, cards et statuts, avec plusieurs très petits textes. Faire une chronologie puis des événements compacts. | REDESIGN | 5 / 7 / 6 / 4 | 2 |
| Profils suivis détaillés | Structure à vérifier sur appareil pour les localisations masquées et les actions de suivi. | REFINE | 6 / 5 / 6 / 3 | 2 |

### Synthèse de priorité visuelle

| Écran | Impact utilisateur | Problème esthétique | Problème UX | Effort | Ordre |
|---|---:|---:|---:|---:|---|
| Accueil | 10 | 7 | 9 | 6 | 1 |
| Favoris événements | 9 | 7 | 8 | 5 | 1 |
| Favoris suivis | 7 | 7 | 8 | 3 | 1 |
| Chargement propositions | 6 | 9 | 5 | 2 | 1, correction rapide |
| Chargement favoris | 6 | 7 | 6 | 2 | 1, correction rapide |
| Depuis une affiche | 7 | 6 | 6 | 3 | 2 |
| Notifications | 7 | 8 | 7 | 3 | 2 |
| Mes suggestions | 7 | 7 | 6 | 4 | 2 |
| Drawer | 8 | 6 | 8 | 5 | 2 |
| Authentification | 9 | 6 | 6 | 4 | 2 |

---

## O. Priority roadmap

Les fenêtres supposent un designer produit et un développeur React Native disponibles, avec QA régulière. La famille Blender demande une compétence graphique dédiée. Les durées doivent être révisées après les premiers prototypes.

### Quick wins — 1 à 2 semaines — Wave 1: identity

| Travail | Ticket proposé / rattachement | Critère d'acceptation |
|---|---|---|
| Réconcilier documentation et charte verte | MVP-P1-007 | Une source de vérité explicite |
| Uniformiser vous / vos et le glossaire | Sous-ticket Content Design | Plus de mélange dans les parcours Alpha |
| Corriger lime textuel et fontes locales | MVP-P1-007 | Paires de couleurs validées ; famille explicite |
| Retirer baguette et slogan du loader | MVP-P1-007 | Attente cohérente et réduite si demandé |
| Remplacer le panneau de chargement des favoris | MVP-P1-007 | Skeleton ou conservation du contenu |
| Clarifier les libellés des suivis | MVP-P1-007 | Plus de cœur ambigu pour le suivi |
| Ajouter les libellés de navigation | Ticket navigation ciblé | Chaque destination comprise sans deviner l'icône |
| Prototyper les trois EventCards avec les contenus des captures | Ticket étude EventCard v2 | Comparaison sur photo, affiche et absence d'image |
| Auditer la sémantique temporelle | Ticket fiabilité événement | Séance, récurrence et disponibilité distinguées |

Résultat attendu : une voix cohérente, moins de contradictions et une card événement choisie sur des cas réels.

### Foundation — 2 à 4 semaines — Wave 2: consistency

| Travail | Dépendance | Critère d'acceptation |
|---|---|---|
| Tokens v2 et primitives typographiques | Quick wins | Rôles documentés et utilisés |
| EventCard et ses trois variantes | Prototype retenu | Même comportement, trois densités utiles |
| Boutons, champs, sheets et états | Tokens | États complets et accessibles |
| Accueil, Favoris, Notifications | Composants | Couverture des principaux parcours |
| Mes contributions | Content system + `ContributionRow` | Type, statut et retour lisibles |
| Clarification like / favori / intérêt / suivi | Décision produit | Libellés, icônes et effets cohérents |
| Clarification Profil / drawer / contribution | Prototype navigation | Destination prévisible, contribution trouvable |

Résultat attendu : une identité industrialisée sur les surfaces les plus fréquentes.

### Signature experience — 1 à 2 mois — Wave 3: delight

| Travail | Périmètre | Critère d'acceptation |
|---|---|---|
| Famille d'icônes propriétaire | Navigation et fonctions de découverte | Reconnaissable aux tailles réelles |
| Prototype de repères 2,5D | Quelques catégories et zooms | Plus lisible et distinctif que le pin |
| Intégration Mapbox | Atlas, sélection, aperçu | Fluidité validée en release |
| Motion commun | Pression, sauvegarde, sheets, apparition | Amplitude et logique cohérentes |
| Chargement d'affiche | Étapes réelles | Attente compréhensible, aucune précision simulée |
| Test de reconnaissance et d'usage | Écrans sans logo + tâches concrètes | Identité perçue sans baisse de réussite |

Résultat attendu : la signature du produit vient de l'expérience répétée, pas d'un écran de démonstration.

### Advanced polish — later — Wave 4: polish

- transitions partagées si la stack et les tests les rendent fiables ;
- dark mode après validation complète ;
- optimisation 120 Hz sur appareils compatibles ;
- illustrations supplémentaires si les premières sont utiles ;
- ajustements fins d'optique, d'haptique et de cadrage ;
- éventuelle seconde famille display après test ;
- aucun ajout de moteur graphique sans besoin démontré.

### Ordre de décision recommandé

1. Retenir le territoire « Les affiches du coin ».
2. Clarifier les objets Idées / Contributions / Favoris / Aimer / Suivre.
3. Corriger la représentation temporelle des événements.
4. Choisir l'architecture de card sur les vrais médias.
5. Valider navigation et contribution.
6. Industrialiser les composants.
7. Investir dans les repères 2,5D.

---

## Limites et validations nécessaires

- Les dix captures couvrent la contribution depuis une affiche, Mes suggestions, Notifications, le drawer, Favoris, deux chargements, l'accueil et l'authentification.
- Aucune capture de carte, détail événement, inscription, recherche modale, empty state ou erreur n'a été fournie.
- Le comportement du FAB, les animations, le focus, les interactions et la réduction des mouvements doivent être observés sur appareil.
- La distinction entre séance, récurrence et disponibilité doit être vérifiée dans les données et les règles métier avant modification de l'affichage.
- Les scores de priorité servent au triage et ne constituent pas une mesure objective de qualité.
- Les performances des assets 2,5D doivent être mesurées en build release sur iOS et Android milieu de gamme.

## Résultat de la mission

- **Ticket traité :** diagnostic et documentation pour `MVP-P1-007`.
- **Modification applicative :** aucune.
- **Vérifications réalisées pendant l'audit :** lecture des ADR et du périmètre Alpha, inspection ciblée des composants et tokens, revue de la checklist de charte, calculs de contraste et analyse de dix captures iOS.
- **Commandes applicatives :** aucun typecheck, lint ou build requis pour ce document uniquement.
- **Risques restants :** sémantique temporelle, ambiguïté des actions sociales, concurrence Profil/drawer/FAB, couverture incomplète des écrans et absence de mesures sur appareil.
- **Décisions de suivi :** territoire visuel, sémantique Aimer/Favori/Suivre, navigation cible, EventCard v2 et prototype de marker 2,5D.
