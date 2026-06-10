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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  entranceDelay?: number;
  animateEntrance?: boolean;
}

export const FloatingPressable: React.FC<Props> = ({
  children,
  style,
  entranceDelay = 0,
  animateEntrance = true,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const reduceMotion = useReduceMotion();
  const pressScale = useSharedValue(1);
  const entrance = useSharedValue(animateEntrance && !reduceMotion ? 0 : 1);

  React.useEffect(() => {
    if (!animateEntrance || reduceMotion) {
      entrance.value = 1;
      return;
    }
    entrance.value = 0;
    const timer = setTimeout(() => {
      entrance.value = withTiming(1, {
        duration: Motion.duration.fast,
        easing: Motion.easing.emphasized,
      });
    }, entranceDelay);
    return () => clearTimeout(timer);
  }, [animateEntrance, entrance, entranceDelay, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const enterScale =
      Motion.transform.buttonInitialScale +
      entrance.value * (1 - Motion.transform.buttonInitialScale);
    return {
      opacity: entrance.value,
      transform: [{ scale: enterScale * pressScale.value }],
    };
  });

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        pressScale.value = reduceMotion
          ? 1
          : withTiming(Motion.transform.pressScale, { duration: Motion.duration.micro });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressScale.value = reduceMotion
          ? 1
          : withSpring(1, Motion.spring.soft);
        onPressOut?.(event);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
};
