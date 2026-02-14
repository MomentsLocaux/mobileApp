import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

type ProgressBarProps = {
  value: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
  trackColor?: string;
  fillColor?: string;
  height?: number;
  accessibilityLabel?: string;
};

export function ProgressBar({
  value,
  max = 100,
  style,
  trackColor = 'rgba(255, 255, 255, 0.24)',
  fillColor = colors.primary,
  height = 10,
  accessibilityLabel,
}: ProgressBarProps) {
  const progress = useMemo(() => {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(value / max, 1));
  }, [max, value]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Progression'}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(progress * 100),
      }}
      style={[
        styles.track,
        {
          height,
          borderRadius: Math.max(radius.element, height / 2),
          backgroundColor: trackColor,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${progress * 100}%`,
            borderRadius: Math.max(radius.element, height / 2),
            backgroundColor: fillColor,
            minWidth: progress > 0 ? spacing.xs : 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
