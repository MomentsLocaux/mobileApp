import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { colors, typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';

const BURST_MS = 480;
const POP_MS = 420;
const SPECK_OFFSETS = [
  { x: 0, y: -29 },
  { x: 26, y: -13 },
  { x: 26, y: 15 },
  { x: 0, y: 29 },
  { x: -26, y: 15 },
  { x: -26, y: -13 },
] as const;

interface EventHeartButtonProps {
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  hapticsEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  count?: number;
  compactCount?: boolean;
}

function HeartSpeck({
  progress,
  x,
  y,
}: {
  progress: SharedValue<number>;
  x: number;
  y: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, x]) },
      { translateY: interpolate(progress.value, [0, 1], [0, y]) },
      { scale: interpolate(progress.value, [0, 0.25, 1], [0.3, 1, 0.25]) },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[styles.speck, style]} />;
}

export function EventHeartButton({
  active,
  onPress,
  disabled = false,
  hapticsEnabled = true,
  style,
  count,
  compactCount = false,
  accessibilityLabel = active
    ? 'Retirer des favoris'
    : 'Aimer et enregistrer',
}: EventHeartButtonProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (active && !wasActiveRef.current && !reduceMotion) {
      const pop = Easing.bezier(0.2, 0.7, 0.3, 1);
      scale.value = withSequence(
        withTiming(0.86, { duration: 0 }),
        withTiming(1.2, { duration: Math.round(POP_MS * 0.45), easing: pop }),
        withTiming(0.97, { duration: Math.round(POP_MS * 0.3), easing: pop }),
        withTiming(1, { duration: Math.round(POP_MS * 0.25), easing: pop }),
      );
      burst.value = 0;
      burst.value = withTiming(1, {
        duration: BURST_MS,
        easing: Easing.out(Easing.ease),
      });
    } else if (!active || reduceMotion) {
      cancelAnimation(scale);
      cancelAnimation(burst);
      scale.value = 1;
      burst.value = 0;
    }
    wasActiveRef.current = active;
  }, [active, burst, reduceMotion, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.08, 1], [0, 0.45, 0]),
    transform: [{ scale: interpolate(burst.value, [0, 1], [0.75, 1.55]) }],
  }));

  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    if (hapticsEnabled) haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.button, typeof count === 'number' && styles.withCount, style]}
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      activeOpacity={0.86}
    >
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      {SPECK_OFFSETS.map((offset) => (
        <HeartSpeck key={`${offset.x}:${offset.y}`} progress={burst} x={offset.x} y={offset.y} />
      ))}
      <Animated.View style={iconStyle}>
        <BrandIcon name="heart" size={19} active={active} />
      </Animated.View>
      {typeof count === 'number' ? <Text style={styles.count} maxFontSizeMultiplier={compactCount ? 1.3 : undefined}>{compactCount ? new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 0 }).format(count) : count}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.page,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    flexShrink: 0,
    overflow: 'visible',
  },
  withCount: {
    width: 'auto',
    minWidth: 34,
    paddingHorizontal: 8,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.brand.secondary,
  },
  count: { ...typography.caption, fontWeight: '700', color: colors.brand.text },
  speck: {
    position: 'absolute',
    width: 4,
    height: 4,
    marginLeft: -2,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: colors.brand.secondary,
    left: '50%',
    top: '50%',
  },
});
