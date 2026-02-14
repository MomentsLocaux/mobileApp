import React from 'react';
import { View, Pressable, StyleSheet, type ViewProps, type PressableProps } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/components/ui/v2/theme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps extends ViewProps {
  padding?: keyof typeof spacing;
  elevation?: 'sm' | 'md' | 'lg';
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessible?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  elevation = 'md',
  style,
  onPress,
  onLongPress,
  accessibilityRole,
  accessible,
  ...props
}) => {
  const isInteractive = !!onPress || !!onLongPress;
  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value, { duration: 110 }) }],
  }));

  if (isInteractive) {
    return (
      <AnimatedPressable
        style={[
          animatedStyle,
          styles.card,
          { padding: spacing[padding] },
          shadows[elevation],
          style,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          pressed.value = 0.98;
        }}
        onPressOut={() => {
          pressed.value = 1;
        }}
        accessible={accessible ?? true}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityState={{ disabled: false }}
        {...props}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { padding: spacing[padding] },
        shadows[elevation],
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.scale.secondaryAccent[500],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.scale.neutral[200],
  },
});
