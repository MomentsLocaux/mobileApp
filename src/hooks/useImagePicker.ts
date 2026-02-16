import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

export type ImageAsset = {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

interface UseImagePickerResult {
  selectedImage: ImageAsset | null;
  pickImage: (options?: { aspect?: [number, number]; allowsEditing?: boolean }) => Promise<ImageAsset | null>;
  pickImages: (options?: { allowsEditing?: boolean; maxSelection?: number }) => Promise<ImageAsset[]>;
  takePhoto: (options?: { aspect?: [number, number]; allowsEditing?: boolean }) => Promise<ImageAsset | null>;
  clearImage: () => void;
}

const buildAsset = (asset: ImagePicker.ImagePickerAsset): ImageAsset => ({
  uri: asset.uri,
  width: asset.width,
  height: asset.height,
  mimeType: asset.mimeType,
});

export const useImagePicker = (): UseImagePickerResult => {
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);

  const requestPermission = async (type: 'camera' | 'library') => {
    try {
      const { status } =
        type === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('Permission error', err);
      return false;
    }
  };

  const pickImage = useCallback(async (options?: { aspect?: [number, number]; allowsEditing?: boolean }) => {
    const ok = await requestPermission('library');
    if (!ok) {
      console.warn('Permission to access gallery denied');
      return null;
    }

    try {
      const mediaTypes = [(ImagePicker as any).MediaType?.Images ?? 'images'] as any;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return null;
      const asset = buildAsset(result.assets[0]);
      setSelectedImage(asset);
      return asset;
    } catch (err) {
      console.warn('pickImage error', err);
      return null;
    }
  }, []);

  const pickImages = useCallback(async (options?: { allowsEditing?: boolean; maxSelection?: number }) => {
    const ok = await requestPermission('library');
    if (!ok) {
      console.warn('Permission to access gallery denied');
      return [];
    }

    try {
      const mediaTypes = [(ImagePicker as any).MediaType?.Images ?? 'images'] as any;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: options?.allowsEditing ?? false,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: options?.maxSelection ?? 5,
        quality: 0.8,
      } as any);

      if (result.canceled || !result.assets?.length) return [];
      const assets = result.assets.map(buildAsset);
      setSelectedImage(assets[0] || null);
      return assets;
    } catch (err) {
      console.warn('pickImages error', err);
      return [];
    }
  }, []);

  const takePhoto = useCallback(async (options?: { aspect?: [number, number]; allowsEditing?: boolean }) => {
    const ok = await requestPermission('camera');
    if (!ok) {
      console.warn('Permission to access camera denied');
      return null;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return null;
      const asset = buildAsset(result.assets[0]);
      setSelectedImage(asset);
      return asset;
    } catch (err) {
      console.warn('takePhoto error', err);
      return null;
    }
  }, []);

  const clearImage = useCallback(() => setSelectedImage(null), []);

  return { selectedImage, pickImage, pickImages, takePhoto, clearImage };
};
