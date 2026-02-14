import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { animation } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScaleOnPressProps = PressableProps & {
  children: React.ReactNode;
  scaleTo?: number;
  containerStyle?: StyleProp<ViewStyle>;
};

export function ScaleOnPress({
  children,
  scaleTo = animation.pressScale,
  containerStyle,
  onPressIn,
  onPressOut,
  accessibilityRole,
  ...props
}: ScaleOnPressProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    scale.value = withTiming(scaleTo, { duration: animation.fast });
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    scale.value = withTiming(1, { duration: animation.normal });
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      accessible
      accessibilityRole={accessibilityRole ?? 'button'}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, containerStyle]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
