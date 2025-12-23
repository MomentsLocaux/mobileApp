import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

const BUCKET = 'event-media';

export const AdditionalImagesUploader = () => {
  const { pickImage } = useImagePicker();
  const gallery = useCreateEventStore((s) => s.gallery);
  const addGalleryImage = useCreateEventStore((s) => s.addGalleryImage);
  const removeGalleryImage = useCreateEventStore((s) => s.removeGalleryImage);
  const [uploading, setUploading] = useState(false);

  const onPick = async () => {
    if (gallery.length >= 3) {
      Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu’à 3 images supplémentaires.');
      return;
    }
    const asset = await pickImage({ allowsEditing: true });
    if (asset?.uri) {
      await upload(asset.uri);
    }
  };

  const upload = async (uri: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `extra-${Date.now()}.${ext}`;
      const filePath = `gallery/${fileName}`;
      const contentType =
        response.headers.get('content-type') ||
        (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      addGalleryImage({ storagePath: filePath, publicUrl: data.publicUrl });
    } catch (e) {
      console.warn('upload gallery', e);
      Alert.alert('Erreur', 'Impossible de téléverser cette image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Images supplémentaires</Text>
        <Text style={styles.subtitle}>Jusqu’à 3 images</Text>
      </View>

      <View style={styles.grid}>
        {gallery.map((img) => (
          <View key={img.publicUrl} style={styles.thumbWrapper}>
            <Image source={{ uri: img.publicUrl }} style={styles.thumb} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeGalleryImage(img.publicUrl)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {gallery.length < 3 && (
          <TouchableOpacity style={styles.addTile} onPress={onPick} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : (
              <>
                <ImageIcon size={24} color={colors.primary[600]} />
                <Text style={styles.addText}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h5,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbWrapper: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.neutral[100],
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.full,
    padding: 4,
  },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addText: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '600',
  },
});
