import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Motion, createEnterTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface Props {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}

export const MotionReveal: React.FC<Props> = ({
  children,
  delay = 0,
  style,
  enabled = true,
}) => {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion || !enabled ? 1 : 0);

  useEffect(() => {
    if (reduceMotion || !enabled) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, createEnterTiming(Motion.duration.fast)));
  }, [delay, enabled, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * Motion.distance.contentEnterY }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};
