import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { useCreateEventStore } from '@/hooks/useCreateEventStore';

const PRIMARY_BUCKET = 'event-media';
const FALLBACK_BUCKET = 'public';

export const CoverImageUploader = () => {
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
    setUploading(true);
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `cover-${Date.now()}.${ext}`;
      const filePath = `covers/${fileName}`;
      const contentType =
        response.headers.get('content-type') ||
        (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

      const tryUpload = async (bucket: string) =>
        supabase.storage.from(bucket).upload(filePath, arrayBuffer, {
          contentType,
          upsert: true,
        });

      let bucketUsed = PRIMARY_BUCKET;
      let uploadError: any = null;

      const { error: primaryError } = await tryUpload(bucketUsed);
      if (primaryError?.message?.includes('Bucket not found')) {
        bucketUsed = FALLBACK_BUCKET;
        const { error: fallbackError } = await tryUpload(bucketUsed);
        uploadError = fallbackError;
      } else {
        uploadError = primaryError;
      }

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucketUsed).getPublicUrl(filePath);
      setCoverImage({ storagePath: filePath, publicUrl: data.publicUrl });
    } catch (e) {
      console.warn('upload cover', e);
      clearImage();
      setCoverImage(undefined);
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
          <ImageIcon size={40} color={colors.neutral[400]} />
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
    backgroundColor: colors.neutral[100],
  },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtn: {
    position: 'absolute',
    bottom: spacing.md,
    left: '50%',
    transform: [{ translateX: -90 }],
    backgroundColor: colors.neutral[900],
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
