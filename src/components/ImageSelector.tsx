import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { Button } from './ui';
import type { ImageAsset } from '../hooks/useImagePicker';
import { useImagePicker } from '../hooks/useImagePicker';

interface Props {
  label?: string;
  value?: string;
  onChange: (uri: string | null) => void;
  required?: boolean;
}

export const ImageSelector: React.FC<Props> = ({ label = 'Image', value, onChange, required }) => {
  const { pickImage, takePhoto, selectedImage, clearImage } = useImagePicker();
  const currentUri = selectedImage?.uri || value || null;

  const handlePick = async () => {
    const asset = await pickImage();
    if (asset?.uri) onChange(asset.uri);
  };

  const handleCamera = async () => {
    const asset = await takePhoto();
    if (asset?.uri) onChange(asset.uri);
  };

  const handleClear = () => {
    clearImage();
    onChange(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
        {currentUri && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton} accessibilityLabel="Supprimer l'image">
            <Trash2 size={16} color={colors.error[600]} />
            <Text style={styles.clearText}>Supprimer</Text>
          </TouchableOpacity>
        )}
      </View>

      {currentUri ? (
        <View style={styles.preview}>
          <Image source={{ uri: currentUri }} style={styles.image} />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <ImageIcon size={32} color={colors.neutral[400]} />
          <Text style={styles.placeholderText}>Aucune image sélectionnée</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button title="Choisir dans la galerie" onPress={handlePick} variant="outline" />
        <Button title="Prendre une photo" onPress={handleCamera} variant="secondary" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearText: {
    ...typography.bodySmall,
    color: colors.error[600],
    fontWeight: '600',
  },
  preview: {
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    height: 200,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

