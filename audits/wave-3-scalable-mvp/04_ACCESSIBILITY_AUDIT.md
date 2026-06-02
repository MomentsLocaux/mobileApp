# 04 - Accessibility Audit

## Résumé exécutif

L'application a une base visuelle cohérente, mais l'accessibilité est inégale. Certains composants comme `Button` déclarent `accessibilityRole`, mais beaucoup de `TouchableOpacity` icon-only ou custom n'ont pas de label accessible. La carte est par nature difficile pour lecteur d'écran, donc un fallback liste est essentiel pour le MVP.

Niveau actuel : utilisable visuellement, à renforcer avant ouverture large.

## Constats

### Labels accessibles

- `Button` ajoute `accessible` et `accessibilityRole="button"`.
- Plusieurs composants custom utilisent `TouchableOpacity` sans `accessibilityLabel`.
- Les boutons icon-only sont fréquents : back, close, share, like, favorite, notifications.
- Les icônes seules doivent avoir un label et un rôle.

### Touch targets

- Certains boutons utilisent `hitSlop`.
- D'autres icônes ou pills ont des zones potentiellement petites.
- Objectif recommandé : 44x44 pt minimum.

### Carte

- Mapbox n'est pas un composant naturellement accessible.
- La bottom sheet liste les événements et joue le rôle de fallback.
- Il faut garantir que les événements restent accessibles en liste même si la carte est inutilisable.

### Formulaires

- Login/register/create event contiennent beaucoup d'inputs.
- Il faut vérifier labels, erreurs liées aux champs, focus après erreur.
- Les erreurs doivent être textuelles, pas seulement couleur.

### Contrastes et typographie

- Certains textes secondaires utilisent des couleurs faibles sur surfaces colorées.
- Les pills actives/inactives doivent être vérifiées.
- Le support dynamic type/font scaling n'a pas été audité finement.

### États loading/empty/error

- Plusieurs écrans ont des states textuels.
- Certains échecs upload/carte restent peu explicites.

## Risques

- Utilisateur lecteur d'écran bloqué sur carte ou boutons icon-only.
- Touch targets trop petits sur mobile.
- Erreur formulaire non annoncée.
- Contrastes insuffisants sur badges/pills.
- Textes tronqués si font scale élevé.

## Recommandations

- Ajouter `accessibilityLabel` et `accessibilityRole` aux boutons icon-only.
- Garantir touch target 44x44.
- Vérifier contraste WCAG AA sur textes principaux.
- Ajouter fallback liste explicite pour carte.
- Vérifier `allowFontScaling` et layout à 150%/200%.
- Ajouter labels aux inputs.
- Associer messages d'erreur aux champs.

## Quick wins

- Ajouter labels aux boutons back/close/share/like/favorite/notification.
- Ajouter labels aux tabs et actions drawer.
- Tester VoiceOver sur login, carte, détail, création.
- Tester TalkBack sur Android.
- Tester zoom texte système.

## Fichiers concernés

- `src/components/ui/Button.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/map.tsx`
- `src/components/map/MapWrapper.tsx`
- `src/components/search/SearchResultsBottomSheet.tsx`
- `src/components/search/EventResultCard.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/RegisterScreen.tsx`
- `app/events/create/*`
- `src/screens/events/EventDetailScreen.tsx`
- `src/screens/notifications/NotificationsInboxScreen.tsx`

## Scénarios à tester

- Navigation VoiceOver login/register.
- Navigation VoiceOver carte vers liste.
- Ouvrir détail événement depuis liste sans utiliser carte.
- Créer événement au clavier/lecteur d'écran.
- Erreur champ obligatoire annoncée.
- Touch target back/close/favorite.
- Texte système 150%.
- Texte système 200%.
- Contraste dark/light si `automatic`.

## Priorisation

### P0

- Labels accessibles sur actions critiques.
- Fallback liste carte utilisable.
- Formulaires auth/création compréhensibles.

### P1

- Audit contraste WCAG.
- Test VoiceOver/TalkBack complet.
- Font scaling.

### P2

- Accessibilité avancée carte.
- Ordre de focus optimisé.
- Annonces live regions.
