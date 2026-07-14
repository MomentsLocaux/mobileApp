import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { colors, borderRadius, spacing, typography } from '@/constants/theme';

export function PremiumMemberBadge() {
  return (
    <View style={styles.badge}>
      <Crown size={14} color={colors.brand.primary} strokeWidth={2.5} />
      <Text style={styles.label}>Moments Locaux+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.premiumLight,
    borderWidth: 1,
    borderColor: colors.brand.premiumBorder,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
