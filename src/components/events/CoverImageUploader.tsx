import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';
import { useAuth } from '@/hooks';

const PRIMARY_BUCKET = 'event-media';

export const CoverImageUploader = () => {
  const { user } = useAuth();
  const { selectedImage, pickImage, clearImage } = useImagePicker();
  const coverImage = useCreateEventStore((s) => s.coverImage);
  const setCoverImage = useCreateEventStore((s) => s.setCoverImage);
  const [uploading, setUploading] = useState(false);

  const onPick = async () => {
    const asset = await pickImage({ allowsEditing: true, aspect: [16, 9] });
    if (asset?.uri) {
      await upload(asset.uri);
    }
  };

  const upload = async (uri: string) => {
    if (!user?.id) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour ajouter une image.');
      return;
    }

    setUploading(true);
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `cover-${Date.now()}.${ext}`;
      const filePath = `event-covers/${user.id}/${fileName}`;
      const contentType =
        response.headers.get('content-type') ||
        (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

      const { error: uploadError } = await supabase.storage.from(PRIMARY_BUCKET).upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(PRIMARY_BUCKET).getPublicUrl(filePath);
      setCoverImage({ storagePath: filePath, publicUrl: data.publicUrl });
    } catch (e) {
      console.warn('upload cover', e);
      clearImage();
      setCoverImage(undefined);
      Alert.alert('Erreur', "Impossible de téléverser l'image de couverture.");
    } finally {
      setUploading(false);
    }
  };

  const uri = coverImage?.publicUrl || selectedImage?.uri;

  return (
    <View style={styles.container}>
      {uri ? (
        <Image source={{ uri }} style={styles.hero} />
      ) : (
        <View style={styles.placeholder}>
          <ImageIcon size={40} color={colors.brand.textSecondary} />
        </View>
      )}
      <TouchableOpacity style={styles.overlayBtn} onPress={onPick} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <ImageIcon size={18} color="#fff" />
            <Text style={styles.overlayText}>Photo de couverture</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  hero: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
  },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtn: {
    position: 'absolute',
    bottom: spacing.md,
    left: '50%',
    transform: [{ translateX: -90 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overlayText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
