// Review only: deterministic Reduce Motion. Native animations require device QA.
import { useRef } from 'react';
import { View } from 'react-native';
export default { View };
export const useSharedValue = value => useRef({ value }).current;
export const useAnimatedStyle = callback => callback();
export const cancelAnimation = () => {};
export const withTiming = (value, config, complete) => { if (complete) complete(true); return value; };
export const runOnJS = callback => callback;
export const interpolate = (value, input, output) => value ? output[output.length - 1] : output[0];
export const useReduceMotion = () => true;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const DateRangePicker = () => null;
export const Easing = { bezier: () => value => value };
