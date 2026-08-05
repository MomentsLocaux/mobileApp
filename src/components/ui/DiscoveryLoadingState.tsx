import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MapPin, type LucideIcon } from 'lucide-react-native';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { MotionReveal } from './MotionReveal';

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
};

export function DiscoveryLoadingState({ title, subtitle, icon: LoadingIcon = MapPin }: Props) {
  return (
    <MotionReveal style={styles.reveal}>
      <View
        style={styles.container}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={title}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.spinnerShell}>
          <ActivityIndicator size="large" color={colors.brand.secondary} />
          <View style={styles.pinBadge} pointerEvents="none">
            <LoadingIcon size={16} color={colors.brand.secondary} strokeWidth={2.5} />
          </View>
        </View>

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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(26, 36, 38, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.2)',
  },
  spinnerShell: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pinBadge: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.page,
    borderWidth: 1,
    borderColor: 'rgba(124, 181, 24, 0.35)',
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
