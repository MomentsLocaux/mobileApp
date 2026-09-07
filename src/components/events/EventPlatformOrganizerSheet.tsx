import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
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
  onClose: () => void;
  onClaim: () => void;
};

export function EventPlatformOrganizerSheet({ visible, showClaimCta, onClose, onClaim }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = reduceMotion
        ? 1
        : withSpring(1, Motion.spring.sheet);
    } else {
      progress.value = reduceMotion ? 0 : withTiming(0, { duration: Motion.duration.fast });
    }
  }, [visible, reduceMotion, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 28 }],
  }));

  const closeAnimated = () => {
    haptics.light();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeAnimated}>
      <View style={styles.root}>
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
            Cette fiche vient d’un agenda public. L’organisateur n’a pas encore de page sur Moments
            Locaux.
          </Text>

          <View style={styles.actions}>
            <Button title="J’ai compris" onPress={closeAnimated} fullWidth />
            {showClaimCta ? (
              <Button
                title="Parlons de vos événements"
                variant="ghost"
                onPress={onClaim}
                fullWidth
              />
            ) : null}
          </View>
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
  actions: {
    gap: spacing.sm,
  },
});
