import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { animation, colors, radius, shadows, spacing } from '../theme';
import { ScaleOnPress } from '../animations/ScaleOnPress';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: CardPadding;
  onPress?: () => void;
  disabled?: boolean;
};

export function Card({ children, style, padding = 'md', onPress, disabled = false }: CardProps) {
  const body = <View style={[styles.base, paddingStyles[padding], style]}>{children}</View>;

  if (!onPress) {
    return body;
  }

  return (
    <ScaleOnPress
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      scaleTo={animation.cardPressScale}
      containerStyle={styles.pressableWrap}
    >
      {body}
    </ScaleOnPress>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.surfaceSoft,
  },
  pressableWrap: {
    borderRadius: radius.card,
  },
});

const paddingStyles = StyleSheet.create({
  none: {
    padding: 0,
  },
  sm: {
    padding: spacing.sm,
  },
  md: {
    padding: spacing.md,
  },
  lg: {
    padding: spacing.lg,
  },
});
