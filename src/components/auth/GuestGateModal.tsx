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
import { LinearGradient } from 'expo-linear-gradient';
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
          ]}
        >
          <LinearGradient
            colors={['rgba(43,191,227,0.18)', 'rgba(26,36,38,0)']}
            style={styles.glow}
            pointerEvents="none"
          />
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.iconBubble}>
              <UserPlus size={22} color={colors.brand.primary} strokeWidth={2.25} />
            </View>
            <FloatingPressable
              style={styles.closeBtn}
              onPress={closeAnimated}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              animateEntrance={false}
            >
              <X size={18} color={colors.brand.text} />
            </FloatingPressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            Cette fonctionnalité est réservée aux membres de Moments Locaux.
          </Text>
          <Text style={styles.value}>
            Créez un compte pour publier, enregistrer vos découvertes et participer à la vie locale.
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 14, 16, 0.45)',
  },
  sheet: {
    backgroundColor: '#121a1c',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    gap: spacing.sm,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.secondary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
