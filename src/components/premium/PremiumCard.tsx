import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/constants/theme';

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
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
  premium: {
    borderTopColor: colors.brand.premiumBorder,
  },
});
