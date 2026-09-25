import React from 'react';
import { View, Pressable, StyleSheet, type ViewProps, type PressableProps } from 'react-native';
import { colors, spacing } from '../../constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  elevation: _elevation = 'md',
  style,
  onPress,
  onLongPress,
  accessibilityRole,
  accessible,
  ...props
}) => {
  const isInteractive = !!onPress || !!onLongPress;
  const reduceMotion = useReduceMotion();
  void _elevation;
  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value }],
  }));

  if (isInteractive) {
    return (
      <AnimatedPressable
        style={[
          animatedStyle,
          styles.card,
          { padding: spacing[padding] },
          style,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          pressed.value = reduceMotion
            ? 1
            : withTiming(Motion.transform.pressScale, { duration: Motion.duration.micro });
        }}
        onPressOut={() => {
          pressed.value = reduceMotion ? 1 : withSpring(1, Motion.spring.soft);
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
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.line,
  },
});
