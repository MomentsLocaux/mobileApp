# Image Picker (Expo)

## Résumé
Utilisation d`'expo-image-picker` pour choisir ou prendre des photos (dev client uniquement, pas Expo Go).

## Permissions
- iOS (Info.plist) : `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription`
- Android (AndroidManifest) : `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`
> Déjà configuré dans `app.config.ts` (expo prebuild requis).

## Commandes build (à lancer après install/config)
```bash
npx expo prebuild --clean
npx expo run:ios      # dev client iOS
npx expo run:android  # dev client Android
```

## Hook `useImagePicker`
Fichier : `src/hooks/useImagePicker.ts`
```ts
import { useImagePicker } from '@/hooks/useImagePicker';

const { selectedImage, pickImage, takePhoto, clearImage } = useImagePicker();
```
- `pickImage()`: galerie
- `takePhoto()`: caméra
- `selectedImage`: `{ uri, width?, height?, mimeType? }`
- `clearImage()`: reset

## Composant `ImageSelector`
Fichier : `src/components/ImageSelector.tsx`
```tsx
<ImageSelector
  label="Photo de couverture"
  required
  value={coverUrl}
  onChange={(uri) => setCoverUrl(uri || '')}
/>;
```
Fonctionnalités : preview, choisir photo, prendre photo, supprimer.

## Intégration
- Écran création d’événement utilise `ImageSelector` pour la couverture.
- Le hook gère permissions/refus/annulation avec logs (warn) et états neutres.

## Notes
- Tester sur dev client (pas Expo Go).
- Si permissions refusées : check dans Réglages.
