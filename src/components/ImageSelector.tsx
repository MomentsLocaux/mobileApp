import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/components/ui/v2/theme';
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
    const asset = await pickImage({ aspect: [16, 9] });
    if (asset?.uri) onChange(asset.uri);
  };

  const handleCamera = async () => {
    const asset = await takePhoto({ aspect: [16, 9] });
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
            <Trash2 size={16} color={colors.scale.error[600]} />
            <Text style={styles.clearText}>Supprimer</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.previewWrapper}>
        {currentUri ? (
          <View style={styles.preview}>
            <Image source={{ uri: currentUri }} style={styles.image} />
          </View>
        ) : (
          <View style={styles.placeholder}>
            <ImageIcon size={32} color={colors.scale.neutral[400]} />
            <Text style={styles.placeholderText}>Aucune image sélectionnée</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.uploadCircle}
          onPress={() =>
            Alert.alert('Photo', 'Choisissez une option', [
              { text: 'Galerie', onPress: handlePick },
              { text: 'Prendre une photo', onPress: handleCamera },
              { text: 'Annuler', style: 'cancel' },
            ])
          }
          accessibilityLabel="Choisir ou prendre une photo"
        >
          <Plus size={20} color={colors.scale.neutral[0]} />
        </TouchableOpacity>
      </View>
      <Text style={styles.uploadHint}>Importer ou prendre une photo</Text>
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
    color: colors.scale.neutral[800],
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearText: {
    ...typography.bodySmall,
    color: colors.scale.error[600],
    fontWeight: '600',
  },
  preview: {
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.scale.neutral[100],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    height: 200,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
    backgroundColor: colors.scale.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderText: {
    ...typography.bodySmall,
    color: colors.scale.neutral[500],
  },
  previewWrapper: {
    position: 'relative',
  },
  uploadCircle: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.scale.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  uploadHint: {
    ...typography.caption,
    color: colors.scale.neutral[600],
    textAlign: 'center',
  },
});
