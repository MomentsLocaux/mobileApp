import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { BrandLogoSpinner } from './BrandLogoSpinner';
import { MotionReveal } from './MotionReveal';

type Props = {
  title: string;
  subtitle?: string;
};

export function DiscoveryLoadingState({ title, subtitle }: Props) {
  return (
    <MotionReveal style={styles.reveal}>
      <View
        style={styles.container}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={title}
        accessibilityLiveRegion="polite"
      >
        <BrandLogoSpinner accessibilityLabel={title} />

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </MotionReveal>
  );
}

const styles = StyleSheet.create({
  reveal: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  title: {
    ...typography.h5,
    color: colors.brand.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
