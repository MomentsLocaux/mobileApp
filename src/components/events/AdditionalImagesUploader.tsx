import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/components/ui/v2';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

export const AdditionalImagesUploader = () => {
  const { pickImage } = useImagePicker();
  const gallery = useCreateEventStore((s) => s.gallery);
  const addGalleryImage = useCreateEventStore((s) => s.addGalleryImage);
  const markRemoved = useCreateEventStore((s) => s.markGalleryImageRemoved);
  const [uploading, setUploading] = useState(false);

  const onPick = async () => {
    const activeCount = gallery.filter((g) => g.status !== 'removed').length;
    if (activeCount >= 3) {
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
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        Alert.alert('Connexion requise', 'Vous devez être connecté pour ajouter des images.');
        return;
      }

      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `extra-${Date.now()}.${ext}`;
      const filePath = `gallery/${fileName}`;
      const contentType =
        response.headers.get('content-type') ||
        (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

      const { error: uploadError } = await supabase.storage.from('event-media').upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });
      if (uploadError) {
        console.warn('upload gallery error', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('event-media').getPublicUrl(filePath);
      if (!gallery.find((g) => g.publicUrl === data.publicUrl)) {
        addGalleryImage({ storagePath: filePath, publicUrl: data.publicUrl, status: 'added' });
      }
    } catch (e) {
      console.warn('upload gallery', e);
      const message = e instanceof Error ? e.message : 'Impossible de téléverser cette image.';
      Alert.alert('Erreur', message);
    } finally {
      setUploading(false);
    }
  };

  const validGallery = gallery.filter(
    (g) => g.status !== 'removed' && !!g.publicUrl && g.publicUrl.trim().length > 0
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Images supplémentaires</Text>
        <Text style={styles.subtitle}>Jusqu’à 3 images</Text>
      </View>

      <View style={styles.grid}>
        {validGallery.map((img) => (
          <View key={img.id || img.storagePath || img.publicUrl} style={styles.thumbWrapper}>
            <Image
              source={{ uri: img.publicUrl }}
              style={styles.thumb}
              onError={() => {
                console.warn('[gallery] failed to load image, marking removed', img.publicUrl);
                markRemoved(img.publicUrl);
              }}
            />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => {
                markRemoved(img.publicUrl);
              }}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {validGallery.length < 3 ? (
          <TouchableOpacity style={styles.addTile} onPress={onPick} disabled={uploading} accessibilityRole="button">
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <ImageIcon size={24} color={colors.primary} />
                <Text style={styles.addText}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {gallery.length > 0 && (
        <View style={{ marginTop: spacing.xs }}>
          {/** removal handled per thumb button; kept for visual spacing */}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceLevel1,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.surfaceSoft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.subsection,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbWrapper: {
    width: 96,
    height: 96,
    borderRadius: radius.element,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceLevel2,
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
    borderRadius: radius.pill,
    padding: 4,
  },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: radius.element,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceLevel2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
