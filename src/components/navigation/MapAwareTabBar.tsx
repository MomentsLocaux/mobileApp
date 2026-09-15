import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const INTERACTIVE_PROGRESS_THRESHOLD = 0.05;

const MapTabBarProgressContext = createContext<SharedValue<number> | null>(null);

export function MapTabBarMotionProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);

  return (
    <MapTabBarProgressContext.Provider value={progress}>
      {children}
    </MapTabBarProgressContext.Provider>
  );
}

export function useMapTabBarProgress() {
  const progress = useContext(MapTabBarProgressContext);
  if (!progress) {
    throw new Error('useMapTabBarProgress must be used inside MapTabBarMotionProvider');
  }
  return progress;
}

export function MapAwareTabBar({
  containerHeight,
  ...props
}: BottomTabBarProps & { containerHeight: number }) {
  const mapProgress = useMapTabBarProgress();
  const reduceMotion = useReduceMotion();
  const isMapActive = props.state.routes[props.state.index]?.name === 'map';
  const [interactive, setInteractive] = useState(!isMapActive);

  useEffect(() => {
    if (!isMapActive) setInteractive(true);
  }, [isMapActive]);

  useAnimatedReaction(
    () => (isMapActive ? mapProgress.value : 1),
    (progress, previousProgress) => {
      const nextInteractive = progress > INTERACTIVE_PROGRESS_THRESHOLD;
      const wasInteractive =
        previousProgress != null && previousProgress > INTERACTIVE_PROGRESS_THRESHOLD;
      if (previousProgress == null || nextInteractive !== wasInteractive) {
        runOnJS(setInteractive)(nextInteractive);
      }
    },
    [isMapActive],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const progress = isMapActive ? mapProgress.value : 1;
    const resolvedProgress = reduceMotion
      ? progress > INTERACTIVE_PROGRESS_THRESHOLD
        ? 1
        : 0
      : progress;

    return {
      opacity: interpolate(resolvedProgress, [0, 0.2, 1], [0, 0.35, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            resolvedProgress,
            [0, 1],
            [96, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [isMapActive, reduceMotion]);

  return (
    <Animated.View
      pointerEvents={interactive ? 'auto' : 'none'}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
      style={[
        isMapActive ? styles.overlay : null,
        isMapActive ? { height: containerHeight } : null,
        animatedStyle,
      ]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
});
