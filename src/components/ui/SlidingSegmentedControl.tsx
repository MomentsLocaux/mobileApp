import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { borderRadius, colors, typography } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/utils/haptics';

const TRACK_HEIGHT = 36;
const PAD = 3;

export type SlidingSegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  value: T;
  options: readonly SlidingSegmentOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** Smaller labels for longer copy (e.g. « Ceux qui me suivent »). */
  compact?: boolean;
};

export function SlidingSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  compact = false,
}: Props<T>) {
  const reduceMotion = useReduceMotion();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const progress = useSharedValue(selectedIndex);
  const thumbWidth = useSharedValue(0);
  const count = Math.max(1, options.length);

  useEffect(() => {
    progress.value = reduceMotion
      ? selectedIndex
      : withSpring(selectedIndex, Motion.spring.snappy);
  }, [progress, reduceMotion, selectedIndex]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: thumbWidth.value,
    transform: [{ translateX: progress.value * thumbWidth.value }],
    opacity: thumbWidth.value > 0 ? 1 : 0,
  }));

  return (
    <View
      style={styles.track}
      onLayout={(event) => {
        const next = (event.nativeEvent.layout.width - PAD * 2) / count;
        thumbWidth.value = next > 0 ? next : 0;
      }}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.option}
            onPress={() => {
              if (option.value === value) return;
              haptics.selection();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            hitSlop={4}
          >
            <Text
              style={[styles.label, compact && styles.labelCompact, selected && styles.labelSelected]}
              numberOfLines={1}
              adjustsFontSizeToFit={compact}
              minimumFontScale={0.8}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TRACK_HEIGHT,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(26, 51, 41, 0.10)',
    padding: PAD,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    bottom: PAD,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
  },
  option: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  labelCompact: {
    ...typography.caption,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  labelSelected: {
    color: colors.brand.onAccent,
  },
});
