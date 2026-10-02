import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus, X } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { Button } from '@/components/ui/Button';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSignUp: () => void;
  onSignIn?: () => void;
};

export const GuestGateModal = ({ visible, title, onClose, onSignUp, onSignIn }: Props) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = reduceMotion ? 1 : withSpring(1, Motion.spring.sheet);
  }, [progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 40 }],
    opacity: 0.94 + progress.value * 0.06,
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
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
            sheetStyle,
            { zIndex: 2 },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.iconBubble}>
              <UserPlus size={22} color={colors.brand.secondary} strokeWidth={2.25} />
            </View>
            <FloatingPressable
              style={styles.closeBtn}
              onPress={closeAnimated}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              animateEntrance={false}
            >
              <X size={18} color={colors.brand.textSecondary} />
            </FloatingPressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            Un compte est nécessaire pour cette action.
          </Text>
          <Text style={styles.value}>
            Vous pouvez continuer à parcourir les moments en invité. Créez un compte, ou connectez-vous, pour participer.
          </Text>

          <Button title="Créer un compte" onPress={onSignUp} fullWidth />
          {onSignIn ? (
            <FloatingPressable
              style={styles.linkBtn}
              onPress={onSignIn}
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
              animateEntrance={false}
            >
              <Text style={styles.linkText}>Se connecter</Text>
            </FloatingPressable>
          ) : null}
          <FloatingPressable
            style={styles.closeTextBtn}
            onPress={closeAnimated}
            accessibilityRole="button"
            accessibilityLabel="Continuer en invité"
            animateEntrance={false}
          >
            <Text style={styles.closeText}>Continuer en invité</Text>
          </FloatingPressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  androidDim: {
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    borderTopWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.08)',
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 51, 41, 0.2)',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 181, 24, 0.12)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.12)',
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.brand.text,
  },
  value: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  closeTextBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
