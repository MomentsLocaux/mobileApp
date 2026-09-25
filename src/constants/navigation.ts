import { Motion } from '@/constants/motion';

/** Horizontal push. On iOS this is the system slide; on Android it replaces the theme fade. */
export const stackPushOptions = {
  animation: 'slide_from_right' as const,
  animationDuration: Motion.duration.slow,
};

/** Full-screen sheet. Duration applies on iOS; 380 ms instead of the 500 ms default. */
export const stackModalOptions = {
  presentation: 'modal' as const,
  animation: 'slide_from_bottom' as const,
  gestureEnabled: true,
  animationDuration: Motion.duration.slow,
};
