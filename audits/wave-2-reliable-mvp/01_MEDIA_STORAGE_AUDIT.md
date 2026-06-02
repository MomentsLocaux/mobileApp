# 01 - Media & Storage Audit

## Résumé exécutif

Les médias couvrent les besoins MVP : avatar, cover profil, cover événement, galerie événement et contributions photo. Les parcours fonctionnels existent, mais la fiabilité store/bêta dépendra surtout de la gouvernance Storage : chemins, ownership, taille maximale, compression, suppression et absence de fallback vers un bucket trop générique.

Niveau actuel : fonctionnel mais à sécuriser. Le risque principal n'est pas l'UX d'upload, c'est l'absence de garde forte côté Storage/RLS et la possibilité de laisser des fichiers orphelins.

## Constats

### Avatars et covers profil

- `ProfileEditScreen` utilise `ImagePicker` puis `ProfileService.uploadAvatar`.
- `supabase-provider.uploadAvatar` écrit sous `avatars/${userId}-${Date.now()}.${ext}`.
- La cover profil semble utiliser le même upload avatar, donc même bucket/chemin fonctionnellement générique.
- Les URLs retournées sont publiques via `getPublicUrl`.

### Covers événements

- `CoverImageUploader` uploade directement dans `event-media`, chemin `covers/cover-${Date.now()}.${ext}`.
- `supabase-provider.uploadEventCover` existe aussi avec chemin `event_covers/${userId}-${Date.now()}.${ext}`.
- Il y a donc plusieurs conventions de chemin pour les covers événement.
- `CoverImageUploader` a un fallback vers bucket `public` si `event-media` n'existe pas.

### Galerie événement

- `setEventMedia` limite à 3 médias actifs.
- La suppression de lignes `event_media` ne supprime pas forcément les objets Storage associés.
- En édition, `preview` tente de retirer certains fichiers supprimés, mais cette logique dépend du client.

### Contributions photo

- `EventPhotoContributionModal` uploade dans `event-media`, chemin `contrib/${eventId}/${userId}/contrib-${Date.now()}.${ext}`.
- La contribution est ensuite créée dans `event_media_submissions`.
- Limite fonctionnelle : `MAX_CONTRIB_PER_EVENT = 5`.
- Le texte indique une validation par organisateur, mais la décision MVP actuelle retire la modération admin mobile. Il faut clarifier qui valide ces photos dans le MVP.

### Formats, poids et compression

- `useImagePicker` utilise `quality: 0.8`.
- Aucun contrôle explicite de poids maximal avant upload n'a été identifié.
- Aucun redimensionnement garanti avec `expo-image-manipulator`, même si la dépendance est présente.
- Le content-type est déduit du header ou de l'extension.

### Buckets

- Les checks précédents ont identifié `event-media` et `avatar` publics.
- Les migrations locales mentionnent aussi un bucket `avatar`.
- Le code référence `avatars` par défaut via `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars'`, avec fallback `public`.
- Risque de divergence `avatar` vs `avatars`.

### Orphelins

- L'audit data précédent a identifié des fichiers Storage probablement orphelins.
- Les migrations contiennent de nombreux médias de test Picsum.
- La suppression compte/événement n'a pas encore de stratégie complète de purge Storage.

## Risques

- Upload dans un bucket `public` trop permissif.
- Utilisateur pouvant uploader ou écraser dans un chemin non propriétaire si les policies Storage sont faibles.
- Covers/profils trop lourds, provoquant lenteurs ou mémoire élevée.
- Fichiers orphelins après suppression événement, édition média ou suppression compte.
- Divergence entre DB et Storage.
- Contributions photo visibles publiquement avant validation si bucket public et URL connue.

## Recommandations

- Supprimer les fallbacks vers bucket `public` en production.
- Standardiser les chemins :
  - `avatars/{userId}/avatar-{timestamp}.jpg`
  - `profile-covers/{userId}/cover-{timestamp}.jpg`
  - `event-covers/{creatorId}/{eventId}/cover-{timestamp}.jpg`
  - `event-media/{eventId}/{mediaId}.jpg`
  - `event-contrib/{eventId}/{userId}/{submissionId}.jpg`
- Ajouter redimensionnement/compression avant upload : largeur max 1600 pour cover, 512 pour avatar.
- Ajouter contrôle taille max côté client et côté Storage.
- Vérifier MIME types autorisés : jpeg, png, webp si supporté.
- Déplacer les suppressions Storage sensibles côté Edge Function/service role.
- Ne publier les contributions photo qu'après validation réelle.

## Quick wins

- Retirer la possibilité de fallback `public` en build production.
- Harmoniser `avatar` vs `avatars`.
- Ajouter taille max documentée dans les policies bucket.
- Ajouter un script de diagnostic orphelins DB/Storage non destructif.
- Afficher un message utilisateur clair si upload refusé.

## Fichiers concernés

- `src/components/events/CoverImageUploader.tsx`
- `src/components/events/EventPhotoContributionModal.tsx`
- `src/hooks/useImagePicker.ts`
- `src/data-provider/supabase-provider.ts`
- `src/screens/profile/ProfileEditScreen.tsx`
- `app/events/create/preview.tsx`
- `src/services/event-media-submissions.service.ts`
- `supabase/migrations/*storage*`

## Scénarios à tester

- Upload avatar iOS/Android.
- Upload cover profil iOS/Android.
- Upload cover événement depuis galerie.
- Upload cover événement depuis caméra.
- Image très lourde, par exemple 8-15 MB.
- Format non image ou extension inattendue.
- Refus permission photos.
- Refus permission caméra.
- Édition événement avec remplacement cover.
- Suppression média dans galerie.
- Contribution photo puis validation/refus.
- Suppression compte avec médias existants.
- Événement supprimé ou archivé avec médias associés.

## Priorisation

### P0

- Bloquer fallback Storage vers bucket `public` en production.
- Vérifier policies upload/read/delete par propriétaire.
- Définir suppression/anonymisation médias pour suppression compte.
- Empêcher publication publique de contributions non validées.

### P1

- Ajouter compression/redimensionnement garanti.
- Harmoniser chemins et buckets.
- Mettre en place diagnostic orphelins.

### P2

- Ajouter CDN/cache policy optimisée.
- Ajouter génération de thumbnails.
- Automatiser purge des fichiers orphelins.
