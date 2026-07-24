import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { MotionReveal } from './MotionReveal';

type Props = {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

export function EmptyState({ icon: Icon, title, subtitle, ctaLabel, onCtaPress }: Props) {
  return (
    <MotionReveal style={styles.wrap}>
      {Icon ? (
        <View style={styles.iconWrap}>
          <Icon size={28} color={colors.brand.secondary} strokeWidth={2} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity
          style={styles.cta}
          onPress={onCtaPress}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </MotionReveal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.28)',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h5,
    color: colors.brand.text,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    minHeight: 44,
    justifyContent: 'center',
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    fontWeight: '800',
  },
});
