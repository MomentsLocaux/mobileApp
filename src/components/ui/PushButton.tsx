import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
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
import { colors, spacing, typography, minimumTouchTarget } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';
import { BrandIcon, type BrandIconName } from '@/components/ui/BrandIcon';

const TRAVEL = 3;
const WELL_PRIMARY = colors.primary[700];
const WELL_SECONDARY = colors.primary[200];
const FACE_OFF = colors.brand.page;
const FACE_LIT = colors.brand.secondary;
const FACE_PRESS = colors.primary[600];
const CORNER = 15;

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Latched down + lit. Omit for a momentary push CTA. */
  toggled?: boolean;
  disabled?: boolean;
  icon?: BrandIconName;
  iconSize?: number;
  label?: string;
  /** Leaf face (primary CTA) or mint-edged page face (secondary / toggles). */
  tone?: 'primary' | 'secondary';
  /** Square icon well (calendar / pin) or wide labelled CTA. */
  shape?: 'square' | 'pill';
  style?: StyleProp<ViewStyle>;
};

export function PushButton({
  onPress,
  accessibilityLabel,
  toggled,
  disabled = false,
  icon,
  iconSize = 20,
  label,
  tone,
  shape = label ? 'pill' : 'square',
  style,
}: Props) {
  const isToggle = typeof toggled === 'boolean';
  const resolvedTone = tone ?? (isToggle ? 'secondary' : 'primary');
  const isPrimary = resolvedTone === 'primary';
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
    opacity: press.value * 0.28,
    transform: [
      { scale: interpolate(press.value, [0, 1], [0.9, 1.08]) },
    ],
  }));

  const wellStyle = useAnimatedStyle(() => {
    if (isPrimary) return { backgroundColor: WELL_PRIMARY };
    const latched = isToggle ? lit.value : 0;
    return {
      backgroundColor: interpolateColor(latched, [0, 1], [WELL_SECONDARY, WELL_PRIMARY]),
    };
  });

  const faceStyle = useAnimatedStyle(() => {
    const latched = isToggle ? lit.value : 0;
    const depth = Math.min(1, latched * 0.85 + press.value * (isToggle ? 0.45 : 1));
    const travel = reduceMotion ? 0 : interpolate(depth, [0, 1], [0, TRAVEL]);
    const faceColor = isToggle
      ? interpolateColor(Math.min(1, lit.value + press.value * 0.25), [0, 1], [FACE_OFF, FACE_LIT])
      : isPrimary
        ? interpolateColor(press.value, [0, 1], [FACE_LIT, FACE_PRESS])
        : FACE_OFF;
    return {
      transform: [{ translateY: travel }],
      backgroundColor: faceColor,
    };
  });

  const isSquare = shape === 'square';
  const iconColor = colors.brand.ink;

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
        !isSquare && styles.pressablePill,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, isSquare ? styles.haloSquare : styles.haloPill, haloStyle]}
      />
      <Animated.View style={[styles.well, isSquare ? styles.wellSquare : styles.wellPill, wellStyle]}>
        <Animated.View style={[styles.face, isSquare ? styles.faceSquare : styles.facePill, faceStyle]}>
          <Animated.View pointerEvents="none" style={[styles.shine, isSquare && styles.shineSquare]} />
          <Animated.View style={styles.content}>
            {icon ? (
              <BrandIcon
                name={icon}
                size={iconSize}
                active={false}
                color={iconColor}
              />
            ) : null}
            {label ? (
              <Text style={styles.label}>
                {label}
              </Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const WELL_SQUARE = 48;
const FACE_SQUARE = 45;

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
    backgroundColor: 'rgba(124, 181, 24, 0.28)',
  },
  haloSquare: {
    top: -4,
    left: -4,
    width: WELL_SQUARE + 8,
    height: WELL_SQUARE + 8,
    borderRadius: CORNER + 4,
  },
  haloPill: {
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: CORNER + 4,
  },
  well: {
    overflow: 'hidden',
    paddingBottom: TRAVEL,
  },
  wellSquare: {
    width: WELL_SQUARE,
    height: WELL_SQUARE,
    borderRadius: CORNER,
    alignItems: 'center',
  },
  wellPill: {
    minHeight: WELL_SQUARE,
    minWidth: minimumTouchTarget,
    borderRadius: CORNER,
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
  faceSquare: {
    width: FACE_SQUARE,
    height: FACE_SQUARE,
    marginTop: 0,
    borderRadius: CORNER - 1,
  },
  facePill: {
    alignSelf: 'stretch',
    minHeight: FACE_SQUARE,
    borderRadius: CORNER - 1,
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
  shineSquare: {
    borderTopLeftRadius: CORNER - 1,
    borderTopRightRadius: CORNER - 1,
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
    flexShrink: 1,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.brand.ink,
  },
});
