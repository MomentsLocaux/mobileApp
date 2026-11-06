import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { BRAND_MARK_ARROW as ARROW, BRAND_MARK_BASE as BASE, BRAND_MARK_ROUTE as ROUTE } from '@/constants/brand-mark';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Cubic arc length 35.5091116, rounded up to cover the complete stroke.
const ROUTE_LENGTH = 35.51;
const ARROW_LENGTH = 14;
const SIGNATURE_DURATION = 2050;

type Props = {
  size?: number;
  variant?: 'static' | 'signature' | 'loading';
  active?: boolean;
};

function smooth(value: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** Decorative mark. The containing brand row or loading screen owns its label. */
export function AnimatedBrandMark({ size = 36, variant = 'static', active = true }: Props) {
  // Seed the reactive hook synchronously to avoid a moving first frame with Reduce Motion on.
  const initialReduceMotion = useReducedMotion();
  const reduceMotion = useReduceMotion(initialReduceMotion);
  const [appState, setAppState] = useState(AppState.currentState);
  const signatureStarted = useRef(false);
  const signatureSettled = useRef(false);
  const progress = useSharedValue(variant === 'signature' && !reduceMotion ? 0 : 1);
  const running = active && (appState === 'active' || appState == null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(progress);

    if (variant === 'static' || reduceMotion) {
      progress.value = 1;
      if (variant === 'signature' && running) signatureSettled.current = true;
      return;
    }

    if (!running) {
      // Leaving the home or backgrounding the app ends the one-shot, rather than replaying it.
      if (variant === 'signature' && signatureStarted.current) {
        signatureSettled.current = true;
        progress.value = 1;
      }
      return;
    }

    if (variant === 'loading') {
      progress.value = 0;
      progress.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1);
    } else if (!signatureSettled.current) {
      if (!signatureStarted.current) {
        signatureStarted.current = true;
        progress.value = 0;
      }
      // Continue from the current position when effects are replayed by React Strict Mode.
      progress.value = withTiming(1, {
        duration: Math.max(0, (1 - progress.value) * SIGNATURE_DURATION),
        easing: Easing.linear,
      });
    }

    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, running, variant]);

  const frame = useDerivedValue(() => {
    if (variant !== 'signature' || reduceMotion || !running) {
      return { route: 1, arrow: 1, dot: 0, wave: 0, radius: 0.9 };
    }
    const elapsed = progress.value * SIGNATURE_DURATION;
    const signature = Math.min(1, elapsed / 1700);
    const route = signature < 0.55
      ? 0.56 * smooth((signature - 0.07) / 0.48)
      : 0.56 + 0.44 * smooth((signature - 0.55) / 0.25);
    const arrival = Math.max(0, Math.min(1, (elapsed - 1700) / 350));
    return {
      route,
      arrow: smooth((signature - 0.77) / 0.13),
      dot: smooth(arrival / 0.15) * (1 - smooth((arrival - 0.65) / 0.35)),
      wave: smooth((arrival - 0.08) / 0.2) * (1 - smooth((arrival - 0.3) / 0.7)) * 0.65,
      radius: 0.9 + 1.6 * smooth((arrival - 0.08) / 0.92),
    };
  });

  const routeProps = useAnimatedProps(() => ({
    opacity: frame.value.route > 0 ? 1 : 0,
    strokeDashoffset: ROUTE_LENGTH * (1 - frame.value.route),
  }));
  const arrowProps = useAnimatedProps(() => ({
    opacity: frame.value.arrow > 0 ? 1 : 0,
    strokeDashoffset: ARROW_LENGTH * (1 - frame.value.arrow),
  }));
  const dotProps = useAnimatedProps(() => ({ opacity: frame.value.dot }));
  const waveProps = useAnimatedProps(() => ({ opacity: frame.value.wave, r: frame.value.radius }));
  const pulseProps = useAnimatedProps(() => {
    const t = progress.value;
    const travel = Math.max(0, Math.min(1, (t - 0.08) / 0.62));
    return {
      opacity: variant === 'loading' && running && !reduceMotion
        ? smooth((t - 0.08) / 0.08) * (1 - smooth((t - 0.62) / 0.08))
        : 0,
      strokeDashoffset: ROUTE_LENGTH * 0.15 - travel * ROUTE_LENGTH * 1.15,
    };
  });

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Path d={BASE} fill="none" stroke={colors.brand.text} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        <AnimatedPath d={ROUTE} fill="none" stroke={colors.brand.secondary} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[ROUTE_LENGTH, ROUTE_LENGTH]} animatedProps={routeProps} />
        <AnimatedPath d={ARROW} fill="none" stroke={colors.brand.secondary} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[ARROW_LENGTH, ARROW_LENGTH]} animatedProps={arrowProps} />
        <AnimatedPath d={ROUTE} fill="none" stroke={colors.primary[100]} strokeWidth={1.25} strokeLinecap="round" strokeDasharray={[ROUTE_LENGTH * 0.15, ROUTE_LENGTH * 3]} animatedProps={pulseProps} />
        <AnimatedCircle cx={29.2} cy={3.8} r={0.9} fill="none" stroke={colors.brand.secondary} strokeWidth={0.22} animatedProps={waveProps} />
        <AnimatedCircle cx={29.2} cy={3.8} r={0.72} fill={colors.brand.secondary} animatedProps={dotProps} />
      </Svg>
    </View>
  );
}
