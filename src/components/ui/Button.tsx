import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';
import { colors, spacing, borderRadius, typography, minimumTouchTarget } from '../../constants/theme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const normalizedSize = size === 'small' ? 'sm' : size;
  const pressed = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value, { duration: 110 }) }],
  }));

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    pressed.value = 0.98;
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    pressed.value = 1;
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      style={[
        animatedStyle,
        styles.base,
        styles[variant],
        styles[normalizedSize],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible
      accessibilityRole="button"
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.secondaryAccent[500] : colors.primary[600]}
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], styles[`${normalizedSize}Text`]]}>
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    minHeight: minimumTouchTarget,
  },
  primary: {
    backgroundColor: colors.primary[600],
  },
  secondary: {
    backgroundColor: colors.secondaryAccent[500],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  danger: {
    backgroundColor: colors.error[500],
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  sm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  md: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  lg: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  primaryText: {
    color: colors.secondaryAccent[500],
  },
  secondaryText: {
    color: colors.textPrimary[500],
  },
  dangerText: {
    color: colors.secondaryAccent[500],
  },
  outlineText: {
    color: colors.primary[600],
  },
  ghostText: {
    color: colors.primary[600],
  },
  smText: {
    fontSize: 14,
  },
  mdText: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },
});
