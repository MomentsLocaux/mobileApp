import React, { useCallback, useEffect, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Button, FloatingPressable } from '@/components/ui';
import { Motion } from '@/constants/motion';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';

type Props = {
  visible: boolean;
  showClaimCta: boolean;
  variant?: 'agenda' | 'community_suggest';
  onClose: () => void;
  onClaim: () => void;
};

export function EventPlatformOrganizerSheet({
  visible,
  showClaimCta,
  variant = 'agenda',
  onClose,
  onClaim,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      progress.value = reduceMotion
        ? 1
        : withSpring(1, Motion.spring.sheet);
    } else {
      progress.value = reduceMotion ? 0 : withTiming(0, { duration: Motion.duration.fast });
    }
  }, [visible, reduceMotion, progress, dragY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 28 + dragY.value }],
  }));

  const closeAnimated = () => {
    haptics.light();
    onClose();
  };

  const finishSwipeClose = useCallback(() => {
    haptics.light();
    onClose();
  }, [onClose]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-24, 24])
        .onUpdate((event) => {
          if (reduceMotion) return;
          dragY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const shouldClose = event.translationY > 72 || event.velocityY > 900;
          if (!shouldClose) {
            dragY.value = withSpring(0, Motion.spring.sheet);
            return;
          }
          if (reduceMotion) {
            runOnJS(finishSwipeClose)();
            return;
          }
          dragY.value = withTiming(480, { duration: 220 });
          progress.value = withTiming(0, { duration: 220 }, (finished) => {
            if (finished) runOnJS(finishSwipeClose)();
          });
        }),
    [dragY, finishSwipeClose, progress, reduceMotion],
  );

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeAnimated}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdropWrap, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAnimated} accessibilityLabel="Fermer">
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
            )}
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <FloatingPressable
              onPress={closeAnimated}
              accessibilityLabel="Fermer"
              style={styles.closeBtn}
            >
              <X size={18} color={colors.brand.textSecondary} />
            </FloatingPressable>
          </View>

          <Text style={styles.title}>Pourquoi Moments Locaux ?</Text>
          <Text style={styles.body}>
            {variant === 'community_suggest'
              ? 'Cette fiche a été proposée par un membre. Après vérification, elle est publiée par Moments Locaux. Le contributeur n’en devient pas l’organisateur.'
              : 'Cette fiche vient d’un agenda public. L’organisateur n’a pas encore de page sur Moments Locaux.'}
          </Text>

          {showClaimCta ? (
            <View style={styles.claimBlock}>
              <Text style={styles.claimTitle}>Vous êtes l’organisateur de cet événement ?</Text>
              <Text style={styles.body}>
                Contactez-nous pour reprendre cette fiche, la mettre à jour et publier vos prochains moments.
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {showClaimCta ? (
              <Button title="Vous êtes l’organisateur ? Nous écrire" onPress={onClaim} fullWidth />
            ) : null}
            <Button
              title="J’ai compris"
              variant={showClaimCta ? 'outline' : 'primary'}
              onPress={closeAnimated}
              fullWidth
            />
          </View>
        </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 25, 0.35)',
  },
  sheet: {
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 51, 41, 0.2)',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  body: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  claimBlock: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  claimTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '800',
  },
  actions: {
    gap: spacing.sm,
  },
});
