import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Motion, createEnterTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type Props = {
  stepKey: string;
  direction: SharedValue<number>;
  children: React.ReactNode;
};

/** Horizontal enter for the active onboarding step. Chrome and actions stay put. */
export function OnboardingStepFrame({ stepKey, direction, children }: Props) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const travel = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    travel.value = direction.value * 36;
    progress.value = 0;
    progress.value = withTiming(1, createEnterTiming(Motion.duration.normal));
  }, [direction, progress, reduceMotion, stepKey, travel]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * travel.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
