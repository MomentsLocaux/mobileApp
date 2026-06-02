# Audit Design / Cohérence UX/UI - Moments Locaux

## 1. Résumé exécutif

L'application dispose déjà d'une base visuelle crédible pour un MVP : navigation resserrée, thème sombre identifiable, accent cyan, écrans événement riches, création d'événement structurée, et parcours principaux globalement lisibles. Le niveau de cohérence actuel est correct mais encore inégal : environ 7/10 sur les écrans récemment travaillés, plutôt 5/10 sur les écrans issus d'anciennes couches produit.

Le principal sujet avant MVP n'est pas une refonte complète. Le vrai risque est la coexistence de plusieurs langages UI : thème sombre/cyan premium, composants legacy plus clairs, cartes très arrondies, gradients, états vides simples, et quelques éléments gamifiés encore visibles. Cette coexistence peut donner une impression de produit assemblé par couches successives.

Les risques visuels majeurs avant publication sont :

- restes de branding ou terminologie "Lumo" sur des zones visibles ou semi-visibles ;
- densité trop forte sur recherche, communauté et détail événement ;
- gamification encore trop présente dans certains écrans, notamment XP/Lumo/classements ;
- styles locaux qui contournent les composants `Button`, `Card`, `Input`, `ScreenHeader` ;
- absence de pattern centralisé pour badges de statut, empty states, loading states et error states.

Micro-correction effectuée pendant l'audit : le titre d'onboarding `Bienvenue sur Lumo` a été remplacé par `Bienvenue sur Moments Locaux`.

## 2. Incohérences détectées

### Par écran

**Authentification**

- `LoginScreen` utilise une grande image Unsplash, un rendu plus marketing et des champs custom.
- `RegisterScreen` est plus proche du design system sombre avec `ScreenHeader`, `Input` et `Button`.
- Les deux écrans ne donnent pas exactement la même sensation de produit : login très immersif, register plus applicatif.
- L'icône "flash" côté login renvoie encore à une logique Lumo/énergie plutôt qu'à une app locale chaleureuse.

**Onboarding**

- Avant correction, le titre affichait encore `Bienvenue sur Lumo`.
- Les cartes de rôle utilisent encore des couleurs `primary`/`neutral` plus legacy que le thème `brand`.
- Les champs sont des `TextInput` locaux plutôt que le composant `Input`.
- L'écran est fonctionnel, mais visuellement moins aligné avec création d'événement et settings.

**Carte / recherche / filtres**

- La recherche est riche et puissante, mais l'overlay peut vite devenir dense pour un MVP.
- Les chips, catégories, résultats et filtres ont des styles locaux multiples.
- La hiérarchie entre recherche simple et filtres avancés doit être plus nette : par défaut, l'utilisateur doit sentir "je trouve un moment local", pas "je configure un moteur de recherche".

**Liste d'événements**

- `EventResultCard` est très travaillé, avec image large, badges, overlay, tags, état live et favori.
- Le rendu est premium, mais peut basculer vers une logique réseau social si trop de badges/statistiques apparaissent en même temps.
- Le fallback Unsplash dans les résultats doit être remplacé par un visuel local/brand ou un placeholder sobre.

**Détail événement**

- L'écran est riche et utile : média, date, lieu, actions, QR, signalement, check-in.
- La section stats + récompense XP donne une impression de gamification visible qui n'est pas prioritaire MVP.
- Les actions sociales sont nombreuses : like, favori, partage, photo, avis, check-in, signalement. La hiérarchie visuelle doit mieux distinguer action principale et actions secondaires.
- Le CTA de check-in est pertinent, mais le message de récompense Lumo/XP doit être adouci si le wallet/gamification reste masqué.

**Création d'événement**

- Le flow en 3 étapes est solide et compréhensible.
- Le header, la progress bar et le footer donnent un bon repère.
- Plusieurs contrôles sont codés localement plutôt qu'avec les composants partagés.
- Les états de validation, brouillon, pré-remplissage et erreurs sont présents, mais gagneraient à utiliser un même pattern visuel.

**Profil utilisateur**

- La surface visible a été resserrée, ce qui va dans le bon sens MVP.
- Attention aux routes profil encore accessibles indirectement qui affichent offres, wallet, analytics ou gamification avancée.
- Les stats profil doivent rester sobres et réellement alimentées par des données fiables.

**Communauté**

- L'écran mélange communauté simple et classement.
- Les tabs, listes et cartes membres sont lisibles, mais le classement/Lumo donne une tonalité gamifiée.
- Les modales de filtre utilisent un fond clair alors que l'écran principal est sombre.
- Les boutons `Suivre/Suivi` utilisent encore `colors.primary` au lieu de `colors.brand.secondary`.

**Favoris**

- Écran globalement cohérent avec le thème sombre.
- Le ton `pépites enregistrées` est chaleureux et adapté.
- Les cartes sont très arrondies (`28`) et plus larges/visuelles que les cartes standard.
- Le bouton `Vider événements` dans l'onglet créateurs peut être ambigu : il concerne les événements, mais apparaît quand l'utilisateur regarde des créateurs.

**Notifications**

- Écran clair, compact, cohérent avec le thème sombre.
- Les types de notifications incluent encore `Récompense`, `Mission`, `Boutique`, même si les features correspondantes sont masquées.
- Le point non lu utilise `colors.brand.primary`, peu visible sur fond sombre ; il devrait utiliser l'accent ou l'erreur selon le cas.
- Loading, empty et error states existent, mais restent très textuels.

**Paramètres**

- L'écran est maintenant bien resserré pour le MVP.
- Les cards sont lisibles, mais les titres de section en `h4` peuvent être un peu grands dans un écran utilitaire.
- Le radius `xl` donne un rendu très arrondi, moins sobre qu'un panneau settings classique.
- La suppression de compte doit rester visible et réellement finalisée côté conformité store.

**Signalement de bug / signalement de contenu**

- `bug-report` est encore en fond clair alors que le reste du MVP bascule majoritairement en sombre.
- Les catégories et sévérités affichent des valeurs techniques (`bug`, `ux`, `medium`, `critical`) plutôt que des libellés utilisateurs.
- Le formulaire fonctionne, mais l'écran donne une impression plus interne/dev que produit public.
- Le signalement de contenu dans détail événement est mieux intégré, via icône et modal.

**Drawer / navigation principale**

- Le drawer est désormais beaucoup plus MVP-compatible.
- Il reste quelques valeurs codées en dur : version `2.4.0`, email fallback `email@exemple.com`, couleurs hex locales.
- Les sections sont claires, mais `DÉCOUVERTE`, `COMPTE`, `ACTIVITÉ`, `ASSISTANCE` peuvent paraître très structurées pour une app simple. Ce n'est pas bloquant.

### Par composant

**Boutons**

- Le composant `Button` est sain : variantes primary, secondary, outline, ghost, danger.
- Plusieurs écrans utilisent toutefois des boutons locaux : login, création, drawer, favoris, communauté, bug report chips.
- Les boutons destructifs ne sont pas toujours harmonisés entre `danger`, texte rouge et alert native.

**Inputs**

- `Input` est cohérent avec le thème sombre.
- Onboarding, bug report, recherche et login utilisent des wrappers custom.
- Les erreurs de formulaire sont parfois inline, parfois via `Alert.alert`, parfois absentes visuellement.

**Cards**

- Le composant `Card` est sombre, arrondi, avec bordure légère.
- Les cartes événements, favoris, settings, communauté et notifications utilisent des radius différents (`lg`, `xl`, `28`, `full`).
- Les ombres sont faibles côté thème sombre, mais certains styles legacy conservent des logiques de surface claire.

**Badges**

- Les badges catégorie/live/visibilité/statut existent, mais ne semblent pas centralisés.
- Les statuts `draft`, `pending`, `published`, `refused`, `archived` doivent avoir une palette unique et des libellés FR uniques.
- Les badges de modération, visibilité, gratuit, live et notification utilisent des règles différentes.

**Icônes**

- L'app utilise majoritairement `lucide-react-native`, ce qui est bon.
- Quelques écrans utilisent `Ionicons` ou des symboles liés à l'énergie/gamification.
- Les icônes de navigation sont cohérentes ; les icônes de stats/gamification sont à réduire avant MVP.

### Par pattern UI

- Couleurs : `colors.brand` et `colors.primary/neutral` cohabitent trop souvent.
- Typographies : les tailles sont bonnes dans le thème, mais les écrans utilisent beaucoup de overrides locaux.
- Spacing : l'échelle existe, mais certains écrans utilisent des valeurs fixes hors scale.
- Radius : l'app est globalement très arrondie. C'est sympathique, mais parfois moins mature ou moins utilitaire.
- Empty states : présents, mais très variables et souvent minimaux.
- Loading states : spinners simples, rarement contextualisés.
- Error states : beaucoup d'alertes natives ; peu d'erreurs visuelles persistantes dans l'écran.

## 3. Design system minimal recommandé

### Palette

Conserver le thème sombre comme direction principale MVP :

- `brand.background` : fond principal sombre.
- `brand.surface` : surfaces/cards.
- `brand.secondary` : accent principal pour CTA, focus, sélection, notifications actives.
- `error` : suppression, refus, signalement, états dangereux.
- `warning` : pending/modération en attente.
- `success` : published, check-in validé.
- `neutral` : texte secondaire, bordures, placeholders.

Recommandation : limiter `colors.primary` aux anciens écrans en transition, puis migrer progressivement vers `colors.brand`.

### Typographie

- Écran principal : `h2` seulement pour les titres de page.
- Sections compactes : `h5` ou `h6`.
- Cards : titre en `body` ou `bodySmall` bold, pas `h4` sauf carte très importante.
- Labels formulaire : `bodySmall` semibold.
- Métadonnées : `caption`.

Objectif : éviter les titres trop grands dans settings, notifications, modales et panneaux.

### Spacing scale

Utiliser uniquement les tokens existants :

- `xs` : 4/6 pour micro-écarts internes.
- `sm` : 8 pour lignes et chips.
- `md` : 16 pour padding standard.
- `lg` : 24 pour padding écran/card important.
- `xl` : 32 pour grandes respirations.

Éviter les valeurs fixes isolées sauf format imposé : avatar, icon button, tab bar, media ratio.

### Radius scale

Rationalisation recommandée :

- `8` : petites chips, badges, inputs compacts.
- `12` : rows, list items, petits panneaux.
- `16` : cards principales, boutons standards.
- `24` : media cards très visuelles uniquement.
- `full` : avatar, FAB, pills.

Objectif : garder la chaleur sans donner une impression trop "prototype glossy".

### Boutons

- Primaire : fond `brand.secondary`, texte sombre, action principale unique par écran.
- Secondaire : surface sombre + bordure légère.
- Ghost : navigation secondaire ou action discrète.
- Destructif : rouge, libellé explicite, confirmation si impact fort.
- Icon button : taille fixe 40/44/48 selon contexte, fond semi-transparent uniquement sur fond image/sombre.

### Cards

- Event card liste : image, titre, date, lieu, catégorie, favori.
- Event detail cards : date, lieu, check-in, QR si rôle autorisé.
- Profil/community cards : avatar, nom, ville, action follow.
- Notification cards : titre, corps, type, date, indicateur non lu.

Recommandation : ne pas afficher plus de 2 badges simultanés sur une carte événement MVP.

### Badges

Palette statut recommandée :

- `draft` / `Brouillon` : gris neutre.
- `pending` / `En modération` : amber/warning.
- `published` / `Publié` : vert/success.
- `refused` / `Refusé` : rouge/error.
- `archived` / `Archivé` : gris sombre.

Créer idéalement un composant `StatusBadge` partagé pour événements, modération et notifications.

### Formulaires

- Label toujours visible.
- Placeholder utile mais non indispensable à la compréhension.
- Erreur inline sous le champ.
- CTA désactivé lisible, avec raison implicite via champs requis.
- Alert native réservée aux confirmations et erreurs système.

### Empty / loading / error states

Pattern minimal :

- Icône sobre.
- Titre court.
- Description courte.
- CTA optionnel.

Exemples :

- Favoris vide : `Aucun favori` + `Explorez la carte pour enregistrer des événements.`
- Notifications vides : `Aucune notification` + pas de CTA.
- Erreur chargement : `Impossible de charger` + `Réessayer`.

## 4. Quick wins

- Remplacer les derniers libellés visibles `Lumo`, `XP`, `Missions`, `Boutique` sur les écrans MVP par des formulations neutres, sauf si la feature est volontairement exposée.
- Remplacer les fallback Unsplash par un placeholder brand local.
- Harmoniser `bug-report` avec le thème sombre.
- Traduire les chips bug report : `bug` -> `Bug`, `ux` -> `Expérience utilisateur`, `medium` -> `Moyen`, `critical` -> `Critique`.
- Faire dériver la version du drawer depuis la config app plutôt que `Version 2.4.0`.
- Changer le dot non lu notifications vers `brand.secondary`.
- Remplacer les couleurs `primary` visibles dans communauté par `brand.secondary`.
- Réduire ou masquer la card `Gagnez une récompense XP` dans le détail événement pour le MVP public.
- Centraliser les badges de statut événement.
- Vérifier tous les textes en majuscules : garder uniquement les petits labels techniques ou badges.

## 5. Risques à éviter avant MVP

- Ne pas lancer une refonte globale du thème : la base est suffisamment bonne.
- Ne pas introduire une nouvelle librairie UI avant publication.
- Ne pas remplacer tous les composants custom d'un coup : risque élevé sur les formulaires et la navigation.
- Ne pas sur-polir la gamification si wallet/missions/boutique sont masqués.
- Ne pas densifier la recherche avec de nouveaux filtres.
- Ne pas modifier les flows critiques sans matrice de test iOS/Android réelle.
- Ne pas supprimer les routes dormantes dans la même passe qu'un ajustement UI, sauf preuve d'inutilisation.

## 6. Plan d'action priorisé

### P0 - Indispensable avant MVP

- Retirer ou neutraliser les références visibles à `Lumo`, `XP`, `Missions`, `Boutique` dans les écrans MVP.
- Harmoniser onboarding, bug report et communauté avec le thème sombre MVP.
- Centraliser ou au moins aligner les badges `draft`, `pending`, `published`, `refused`, `archived`.
- Remplacer les fallbacks Unsplash par un placeholder brand.
- Réduire la visibilité de la récompense XP dans le détail événement.
- Vérifier empty/loading/error states sur : auth, onboarding, carte, création, favoris, notifications, settings, signalement.

### P1 - Important mais non bloquant

- Migrer progressivement les champs onboarding et bug report vers le composant `Input`.
- Migrer les boutons locaux vers `Button` quand le contexte le permet.
- Rationaliser les radius des cards et boutons.
- Aligner les modales de filtre communauté/recherche sur le thème sombre.
- Ajouter un composant `EmptyState`.
- Ajouter un composant `StatusBadge`.
- Simplifier la densité du détail événement : action principale check-in, actions secondaires regroupées.

### P2 - Post-MVP

- Repenser communauté si le classement/Lumo devient un vrai axe produit.
- Créer une vraie librairie interne de cards événement/profil/notification.
- Réintroduire wallet, missions, boutique et creator analytics avec un design cohérent dédié.
- Ajouter animations et transitions plus sophistiquées seulement après stabilisation des flows.
- Faire un audit accessibilité complet : contrastes, tailles tactiles, lecteurs d'écran, labels, états focus.
