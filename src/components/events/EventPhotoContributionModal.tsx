import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image as ImageIcon, Camera, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { supabase } from '@/lib/supabase/client';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';

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
        Alert.alert('Limite atteinte', result.message || 'Vous avez atteint la limite pour cet événement.');
        return;
      }

      Alert.alert('Merci', 'Votre photo sera publiée après validation.');
      setImageUri(null);
      onSubmitted?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de téléverser cette image.';
      Alert.alert('Erreur', message);
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
              <X size={18} color={colors.neutral[600]} />
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
                <ImageIcon size={40} color={colors.neutral[400]} />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handlePick} disabled={uploading}>
              <ImageIcon size={18} color={colors.primary[700]} />
              <Text style={styles.actionText}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto} disabled={uploading}>
              <Camera size={18} color={colors.primary[700]} />
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  preview: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
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
    borderColor: colors.primary[200],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
  },
  actionText: {
    ...typography.bodySmall,
    color: colors.primary[700],
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary[600],
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
    color: colors.neutral[0],
    fontWeight: '600',
  },
  limitHint: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
