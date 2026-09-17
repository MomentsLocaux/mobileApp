import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography, borderRadius, minimumTouchTarget } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';

const TRAVEL = 5;
const WELL = colors.primary[700];
const FACE_OFF = colors.brand.surface;
const FACE_LIT = colors.brand.secondary;
const FACE_PRESS = colors.primary[600];
const ICON_OFF = colors.brand.secondary;
const ICON_ON = colors.brand.onAccent;

type LucideGlyph = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Latched down + lit. Omit for a momentary push CTA. */
  toggled?: boolean;
  disabled?: boolean;
  icon?: LucideGlyph;
  iconSize?: number;
  label?: string;
  /** Circular icon well (calendar / pin). */
  shape?: 'circle' | 'pill';
  style?: StyleProp<ViewStyle>;
};

export function PushButton({
  onPress,
  accessibilityLabel,
  toggled,
  disabled = false,
  icon: Icon,
  iconSize = 20,
  label,
  shape = label ? 'pill' : 'circle',
  style,
}: Props) {
  const isToggle = typeof toggled === 'boolean';
  const reduceMotion = useReduceMotion();
  const lit = useSharedValue(toggled ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (!isToggle) return;
    lit.value = reduceMotion
      ? toggled
        ? 1
        : 0
      : withSpring(toggled ? 1 : 0, Motion.spring.snappy);
  }, [isToggle, lit, reduceMotion, toggled]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: isToggle ? lit.value * 0.9 : press.value * 0.4,
    transform: [
      { scale: interpolate(isToggle ? lit.value : press.value, [0, 1], [0.86, 1.12]) },
    ],
  }));

  const faceStyle = useAnimatedStyle(() => {
    const latched = isToggle ? lit.value : 0;
    const depth = Math.min(1, latched * 0.85 + press.value * (isToggle ? 0.45 : 1));
    const travel = reduceMotion ? 0 : interpolate(depth, [0, 1], [0, TRAVEL]);
    const faceColor = isToggle
      ? interpolateColor(Math.min(1, lit.value + press.value * 0.25), [0, 1], [FACE_OFF, FACE_LIT])
      : interpolateColor(press.value, [0, 1], [FACE_LIT, FACE_PRESS]);
    return {
      transform: [{ translateY: travel }],
      backgroundColor: faceColor,
    };
  });

  const isCircle = shape === 'circle';
  const iconColor = isToggle ? (toggled ? ICON_ON : ICON_OFF) : ICON_ON;
  const labelColor = isToggle ? (toggled ? ICON_ON : ICON_OFF) : ICON_ON;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        haptics.light();
        press.value = reduceMotion
          ? 1
          : withTiming(1, { duration: Motion.duration.micro });
      }}
      onPressOut={() => {
        press.value = reduceMotion ? 0 : withSpring(0, Motion.spring.snappy);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled,
        selected: isToggle ? Boolean(toggled) : undefined,
      }}
      style={[
        styles.pressable,
        !isCircle && styles.pressablePill,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, isCircle ? styles.haloCircle : styles.haloPill, haloStyle]}
      />
      <View style={[styles.well, isCircle ? styles.wellCircle : styles.wellPill]}>
        <Animated.View style={[styles.face, isCircle ? styles.faceCircle : styles.facePill, faceStyle]}>
          <View pointerEvents="none" style={[styles.shine, isCircle && styles.shineCircle]} />
          <View style={styles.content}>
            {Icon ? <Icon size={iconSize} color={iconColor} strokeWidth={2.4} /> : null}
            {label ? (
              <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const WELL_CIRCLE = 52;
const FACE_CIRCLE = 46;

const styles = StyleSheet.create({
  pressable: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressablePill: {
    alignItems: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(124, 181, 24, 0.38)',
  },
  haloCircle: {
    top: -5,
    left: -5,
    width: WELL_CIRCLE + 10,
    height: WELL_CIRCLE + 10,
    borderRadius: (WELL_CIRCLE + 10) / 2,
  },
  haloPill: {
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: borderRadius.full,
  },
  well: {
    backgroundColor: WELL,
    overflow: 'hidden',
    paddingBottom: TRAVEL,
  },
  wellCircle: {
    width: WELL_CIRCLE,
    height: WELL_CIRCLE,
    borderRadius: WELL_CIRCLE / 2,
    alignItems: 'center',
  },
  wellPill: {
    minHeight: WELL_CIRCLE,
    minWidth: minimumTouchTarget,
    borderRadius: borderRadius.full,
    paddingHorizontal: 2,
    alignSelf: 'stretch',
  },
  face: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 51, 41, 0.22)',
  },
  faceCircle: {
    width: FACE_CIRCLE,
    height: FACE_CIRCLE,
    marginTop: 1,
    borderRadius: FACE_CIRCLE / 2,
  },
  facePill: {
    alignSelf: 'stretch',
    minHeight: FACE_CIRCLE,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  shineCircle: {
    borderTopLeftRadius: FACE_CIRCLE / 2,
    borderTopRightRadius: FACE_CIRCLE / 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    zIndex: 1,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
