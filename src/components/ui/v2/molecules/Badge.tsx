import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Typography } from '../atoms/Typography';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      <Typography variant="caption" color={textColors[tone]} weight="700">
        {label}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
});

const toneStyles = StyleSheet.create({
  neutral: {
    backgroundColor: colors.surfaceLevel2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  success: {
    backgroundColor: colors.success,
  },
  danger: {
    backgroundColor: colors.danger,
  },
});

const textColors: Record<BadgeTone, string> = {
  neutral: colors.textPrimary,
  primary: colors.background,
  success: colors.background,
  danger: colors.textPrimary,
};
