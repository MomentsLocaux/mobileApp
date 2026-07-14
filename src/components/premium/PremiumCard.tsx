import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '@/constants/theme';

type PremiumCardProps = {
  children: React.ReactNode;
  isPremium?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PremiumCard({ children, isPremium = false, style }: PremiumCardProps) {
  return (
    <View style={[styles.base, isPremium && styles.premium, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.brand.surface,
    padding: spacing.md,
  },
  premium: {
    borderWidth: 1.5,
    borderColor: colors.brand.premiumBorder,
    backgroundColor: colors.brand.premiumMuted,
    shadowColor: colors.brand.premium,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
