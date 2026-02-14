import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { animation, colors, radius, shadows, spacing, typography } from '../theme';
import { ScaleOnPress } from '../animations/ScaleOnPress';
import { Typography } from './Typography';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  leftSlot,
  rightSlot,
  onPress,
  ...props
}: ButtonProps) {
  const blocked = loading || disabled;

  return (
    <ScaleOnPress
      accessibilityRole="button"
      disabled={blocked}
      onPress={onPress}
      scaleTo={animation.pressScale}
      containerStyle={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        blocked && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.background : colors.textPrimary} />
      ) : (
        <View style={styles.contentRow}>
          {leftSlot}
          <Typography
            variant="body"
            style={[labelStyles[variant], textStyle]}
            numberOfLines={1}
          >
            {title}
          </Typography>
          {rightSlot}
        </View>
      )}
    </ScaleOnPress>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  md: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    minHeight: 60,
    paddingHorizontal: spacing.xl,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    ...shadows.primaryGlow,
  },
  secondary: {
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.surfaceSoft,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
});

const labelStyles = StyleSheet.create({
  primary: {
    color: colors.background,
    ...typography.bodyStrong,
  },
  secondary: {
    color: colors.textPrimary,
    ...typography.bodyStrong,
  },
  outline: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  ghost: {
    color: colors.primary,
    ...typography.bodyStrong,
  },
  danger: {
    color: colors.textPrimary,
    ...typography.bodyStrong,
  },
});
