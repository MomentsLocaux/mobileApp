import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL } from '@/constants/branding';
import { LUMIA_NAME, type LumiaTourStep } from '@/constants/lumiaTour';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { haptics } from '@/utils/haptics';

type Props = {
  visible: boolean;
  steps: LumiaTourStep[];
  onDismiss: (reason: 'done' | 'skipped') => void;
  onStepChange?: (step: LumiaTourStep) => void;
};

export function LumiaTourOverlay({ visible, steps, onDismiss, onStepChange }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index >= steps.length - 1;
  const progressLabel = useMemo(
    () => (steps.length ? `${index + 1} / ${steps.length}` : ''),
    [index, steps.length],
  );

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      return;
    }
    setIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || !step) return;
    onStepChange?.(step);
  }, [visible, step, onStepChange]);

  if (!steps.length || !step) return null;

  const goNext = () => {
    haptics.selection();
    if (isLast) {
      onDismiss('done');
      return;
    }
    setIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const skip = () => {
    haptics.light();
    onDismiss('skipped');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={skip}
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={styles.scrim}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel="Passer le tour Lumia"
        />
        <View style={[styles.card, { marginBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.identity}>
            <Image source={MOMENTS_LOCAUX_ORGANIZER_AVATAR_LOCAL} style={styles.avatar} />
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Sparkles size={14} color={colors.brand.secondary} />
                <Text style={styles.name}>{LUMIA_NAME}</Text>
              </View>
              <Text style={styles.progress}>{progressLabel}</Text>
            </View>
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.dots}>
            {steps.map((item, i) => (
              <View
                key={item.id}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <Button
            title={isLast ? 'C’est compris' : 'Suivant'}
            onPress={goNext}
            fullWidth
          />
          <Pressable onPress={skip} accessibilityRole="button" style={styles.skipWrap}>
            <Text style={styles.skip}>Passer · ne plus afficher</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 51, 41, 0.28)',
  },
  card: {
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.sm,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...typography.h6,
    color: colors.brand.text,
  },
  progress: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
    marginTop: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.brand.textSecondary,
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
  },
  dotActive: {
    backgroundColor: colors.brand.secondary,
    width: 18,
  },
  skipWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  skip: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textDecorationLine: 'underline',
  },
});
