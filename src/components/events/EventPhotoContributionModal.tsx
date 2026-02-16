import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Image as ImageIcon, Camera, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  eventId: string;
  userId: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

const MAX_CONTRIB_PER_EVENT = 5;

export function EventPhotoContributionModal({ visible, eventId, userId, onClose, onSubmitted }: Props) {
  const { pickImage, takePhoto } = useImagePicker();
  const [uploading, setUploading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const canSubmit = useMemo(() => !!imageUri && !uploading, [imageUri, uploading]);

  const handlePick = async () => {
    const asset = await pickImage({ aspect: [4, 3] });
    if (asset?.uri) setImageUri(asset.uri);
  };

  const handleTakePhoto = async () => {
    const asset = await takePhoto({ aspect: [4, 3] });
    if (asset?.uri) setImageUri(asset.uri);
  };

  const handleUpload = async () => {
    if (!imageUri) return;
    setUploading(true);
    try {
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = imageUri.split('.').pop() || 'jpg';
      const fileName = `contrib-${Date.now()}.${ext}`;
      const filePath = `contrib/${eventId}/${userId}/${fileName}`;
      const contentType =
        response.headers.get('content-type') ||
        (ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg');

      const { error: uploadError } = await supabase.storage.from('event-media').upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('event-media').getPublicUrl(filePath);
      const result = await EventMediaSubmissionsService.submit({
        eventId,
        authorId: userId,
        url: data.publicUrl,
        maxPerEvent: MAX_CONTRIB_PER_EVENT,
      });

      if (!result.success) {
        Toast.show({
          type: 'error',
          text1: 'Limite atteinte',
          text2: result.message || 'Vous avez atteint la limite pour cet événement.',
        });
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Merci',
        text2: 'Votre photo sera publiée après validation.',
      });
      setImageUri(null);
      onSubmitted?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de téléverser cette image.';
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: message,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Proposer une photo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <X size={18} color={colors.brand.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Les photos sont validées par l&apos;organisateur avant d&apos;apparaître publiquement.
          </Text>

          <View style={styles.preview}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <ImageIcon size={40} color={colors.brand.textSecondary} />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePick} disabled={uploading}>
              <ImageIcon size={18} color={colors.brand.secondary} />
              <Text style={styles.actionText}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto} disabled={uploading}>
              <Camera size={18} color={colors.brand.secondary} />
              <Text style={styles.actionText}>Appareil photo</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleUpload}
            disabled={!canSubmit}
          >
            {uploading ? (
              <ActivityIndicator color={colors.neutral[0]} />
            ) : (
              <Text style={styles.submitText}>Envoyer pour validation</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.limitHint}>Limite: {MAX_CONTRIB_PER_EVENT} photos par événement.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 12, 0.76)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.brand.surface,
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  preview: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(43,191,227,0.35)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: 'rgba(43,191,227,0.1)',
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.brand.secondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    ...typography.body,
    color: '#0f1719',
    fontWeight: '600',
  },
  limitHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
