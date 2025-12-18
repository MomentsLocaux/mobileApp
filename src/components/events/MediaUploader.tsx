import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { Upload, X, Image as ImageIcon } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../ui';

interface MediaUploaderProps {
  coverUrl: string;
  gallery: string[];
  onCoverChange: (url: string) => void;
  onGalleryChange: (urls: string[]) => void;
  error?: string;
}

export function MediaUploader({
  coverUrl,
  gallery,
  onCoverChange,
  onGalleryChange,
  error,
}: MediaUploaderProps) {
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  const pickImage = async (onPicked: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l’accès à vos photos pour sélectionner une image.');
      return;
    }
    const mediaTypes = [(ImagePicker as any).MediaType?.Images ?? 'images'] as any;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
      mediaTypes,
    });
    if (!result.canceled && result.assets.length > 0) {
      onPicked(result.assets[0].uri);
    }
  };

  const handleAddToGallery = (url: string) => {
    if (gallery.length < 3 && url.trim()) {
      onGalleryChange([...gallery, url]);
      setNewGalleryUrl('');
    }
  };

  const handleRemoveFromGallery = (index: number) => {
    onGalleryChange(gallery.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photo de couverture *</Text>
        <Text style={styles.sectionHint}>
          Cette image sera affichée en premier sur votre événement
        </Text>

        {coverUrl ? (
          <View style={styles.coverPreview}>
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onCoverChange('')}
            >
              <X size={16} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadArea}>
            <ImageIcon size={40} color={colors.neutral[400]} />
            <Text style={styles.uploadText}>Aucune image</Text>
          </View>
        )}

        <View style={styles.urlInput}>
          <Text style={styles.inputLabel}>Sélectionner une image</Text>
          <Button
            title="Choisir dans la galerie"
            onPress={() => pickImage(onCoverChange)}
            variant="outline"
          />
          <Text style={styles.inputLabel}>Ou coller une URL</Text>
          <Input
            placeholder="https://example.com/image.jpg"
            value={coverUrl}
            onChangeText={onCoverChange}
            error={error}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Galerie (optionnel)</Text>
        <Text style={styles.sectionHint}>
          Ajoutez jusqu&apos;à 3 images supplémentaires
        </Text>

        {gallery.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.galleryScroll}
            contentContainerStyle={styles.galleryContent}
          >
            {gallery.map((url, index) => (
              <View key={index} style={styles.galleryItem}>
                <Image source={{ uri: url }} style={styles.galleryImage} />
                <TouchableOpacity
                  style={styles.removeButtonSmall}
                  onPress={() => handleRemoveFromGallery(index)}
                >
                  <X size={12} color={colors.neutral[0]} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {gallery.length < 3 && (
          <View style={styles.urlInput}>
            <Text style={styles.inputLabel}>
              Ajouter une image ({gallery.length}/3)
            </Text>
            <Button
              title="Depuis la galerie"
              onPress={() => pickImage((uri) => handleAddToGallery(uri))}
              variant="outline"
              style={styles.addButton}
              icon={<Upload size={18} color={colors.primary[600]} />}
            />
            <Input
              placeholder="https://example.com/image.jpg"
              value={newGalleryUrl}
              onChangeText={setNewGalleryUrl}
              onSubmitEditing={() => handleAddToGallery(newGalleryUrl)}
            />
            <Text style={styles.hint}>Validez pour ajouter</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.neutral[900],
    fontWeight: '600',
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  coverPreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadArea: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: colors.neutral[300],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadText: {
    ...typography.body,
    color: colors.neutral[500],
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlInput: {
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  addButton: {
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  hint: {
    ...typography.caption,
    color: colors.neutral[500],
    fontStyle: 'italic',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error[600],
    marginTop: spacing.xs,
  },
  galleryScroll: {
    marginVertical: spacing.sm,
  },
  galleryContent: {
    gap: spacing.sm,
  },
  galleryItem: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButtonSmall: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
