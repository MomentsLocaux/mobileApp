import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const Motion = {
  duration: {
    micro: 120,
    fast: 180,
    normal: 260,
    slow: 380,
    screen: 480,
  },

  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    emphasized: Easing.bezier(0.22, 1, 0.36, 1),
    exit: Easing.bezier(0.4, 0, 1, 1),
  },

  spring: {
    soft: {
      damping: 20,
      stiffness: 180,
      mass: 1,
    } satisfies WithSpringConfig,
    snappy: {
      damping: 16,
      stiffness: 240,
      mass: 0.8,
    } satisfies WithSpringConfig,
    sheet: {
      damping: 24,
      stiffness: 170,
      mass: 1,
    } satisfies WithSpringConfig,
  },

  transform: {
    pressScale: 0.94,
    markerSelectedScale: 1.08,
    cardInitialScale: 0.96,
    buttonInitialScale: 0.85,
  },

  distance: {
    cardEnterY: 80,
    cardExitY: 50,
    contentEnterY: 12,
    listEnterY: 16,
    ctaEnterY: 80,
  },

  stagger: {
    content: 50,
    listItem: 30,
  },
} as const;

export const createEnterTiming = (
  duration: number = Motion.duration.normal
): WithTimingConfig => ({
  duration,
  easing: Motion.easing.emphasized,
});

export const createExitTiming = (
  duration: number = Motion.duration.fast
): WithTimingConfig => ({
  duration,
  easing: Motion.easing.exit,
});

export const createStandardTiming = (
  duration: number = Motion.duration.fast
): WithTimingConfig => ({
  duration,
  easing: Motion.easing.standard,
});
