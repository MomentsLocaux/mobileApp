import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ImageIcon, Camera, ChevronRight, X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { supabase } from '@/lib/supabase/client';
import { EventMediaSubmissionsService } from '@/services/event-media-submissions.service';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { Motion } from '@/constants/motion';
import { haptics } from '@/utils/haptics';

type Props = {
  visible: boolean;
  eventId: string;
  userId: string;
  eventTitle?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
};

const MAX_CONTRIB_PER_EVENT = 5;

export function EventPhotoContributionModal({
  visible,
  eventId,
  userId,
  eventTitle,
  onClose,
  onSubmitted,
}: Props) {
  const { pickImage, takePhoto } = useImagePicker();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const [uploading, setUploading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const canSubmit = useMemo(() => !!imageUri && !uploading, [imageUri, uploading]);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = reduceMotion ? 1 : withSpring(1, Motion.spring.sheet);
  }, [progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 48 }],
    opacity: 0.92 + progress.value * 0.08,
  }));

  const closeAnimated = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    progress.value = withTiming(0, {
      duration: Motion.duration.fast,
      easing: Motion.easing.exit,
    });
    setTimeout(onClose, Motion.duration.fast);
  };

  const handlePick = async () => {
    haptics.selection();
    const asset = await pickImage({ aspect: [4, 3] });
    if (asset?.uri) setImageUri(asset.uri);
  };

  const handleTakePhoto = async () => {
    haptics.selection();
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
      closeAnimated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de téléverser cette image.';
      Alert.alert('Erreur', message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeAnimated}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropWrap, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeAnimated}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
            )}
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
            sheetStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(124, 181, 24,0.14)', 'rgba(244,251,246,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheetGlow}
            pointerEvents="none"
          />

          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>Photo communauté</Text>
              <Text style={styles.title}>Proposer une photo</Text>
              {eventTitle?.trim() ? (
                <View style={styles.eventRow}>
                  <ImageIcon size={14} color={colors.brand.secondary} />
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {eventTitle.trim()}
                  </Text>
                </View>
              ) : null}
            </View>
            <FloatingPressable
              style={styles.closeButton}
              onPress={closeAnimated}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              animateEntrance={false}
            >
              <X size={18} color={colors.brand.text} />
            </FloatingPressable>
          </View>

          <Text style={styles.subtitle}>
            Les photos sont validées par l&apos;organisateur avant d&apos;apparaître publiquement.
          </Text>

          <View style={styles.preview}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <View style={styles.previewIcon}>
                  <ImageIcon size={26} color={colors.brand.secondary} />
                </View>
                <Text style={styles.previewTitle}>Aucune photo sélectionnée</Text>
                <Text style={styles.previewSubtitle}>Choisissez une source ci-dessous</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <FloatingPressable
              style={[styles.actionButton, uploading && styles.disabled]}
              onPress={() => void handlePick()}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Choisir une photo dans la galerie"
              entranceDelay={reduceMotion ? 0 : 40}
            >
              <View style={[styles.actionIcon, styles.actionIconAccent]}>
                <ImageIcon size={20} color={colors.brand.primary} strokeWidth={2.25} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Galerie</Text>
                <Text style={styles.actionSubtitle}>Choisir une photo existante</Text>
              </View>
              <ChevronRight size={18} color={colors.brand.textSecondary} />
            </FloatingPressable>

            <FloatingPressable
              style={[styles.actionButton, uploading && styles.disabled]}
              onPress={() => void handleTakePhoto()}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Prendre une photo"
              entranceDelay={reduceMotion ? 0 : 75}
            >
              <View style={styles.actionIcon}>
                <Camera size={20} color={colors.brand.secondary} strokeWidth={2.25} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Appareil photo</Text>
                <Text style={styles.actionSubtitle}>Prendre une nouvelle photo</Text>
              </View>
              <ChevronRight size={18} color={colors.brand.textSecondary} />
            </FloatingPressable>
          </View>

          <FloatingPressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={() => {
              haptics.selection();
              void handleUpload();
            }}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Envoyer pour validation"
            accessibilityState={{ disabled: !canSubmit, busy: uploading }}
            animateEntrance={false}
          >
            {uploading ? (
              <ActivityIndicator color={colors.brand.onAccent} />
            ) : (
              <Text style={styles.submitText}>Envoyer pour validation</Text>
            )}
          </FloatingPressable>

          <Text style={styles.limitHint}>Limite : {MAX_CONTRIB_PER_EVENT} photos par événement</Text>

          <FloatingPressable
            style={styles.cancelButton}
            onPress={closeAnimated}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            animateEntrance={false}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </FloatingPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  androidDim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,14,16,0.45)',
  },
  sheet: {
    backgroundColor: colors.brand.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  sheetGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26,51,41,0.16)',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
    fontWeight: '800',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventTitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    flexShrink: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(26,51,41,0.08)',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  preview: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(26,51,41,0.08)',
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 176,
  },
  previewPlaceholder: {
    width: '100%',
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.28)',
    marginBottom: 3,
  },
  previewTitle: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
  },
  previewSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(26,51,41,0.08)',
    minHeight: 68,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.28)',
  },
  actionIconAccent: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  disabled: {
    opacity: 0.5,
  },
  submitButton: {
    minHeight: 52,
    marginTop: spacing.md,
    backgroundColor: colors.brand.secondary,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(124, 181, 24,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24,0.22)',
  },
  submitText: {
    ...typography.body,
    color: colors.brand.onAccent,
    fontWeight: '800',
  },
  limitHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.page,
  },
  cancelText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
});
