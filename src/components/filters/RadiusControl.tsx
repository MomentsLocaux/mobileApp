import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import {
  DISCOVERY_MAX_RADIUS_KM,
  DISCOVERY_MIN_RADIUS_KM,
  DISCOVERY_RADIUS_STEP_KM,
  formatRadiusLabel,
} from '@/constants/filters';
import {
  filterColors,
  filterOpacity,
  filterSizing,
  filterSpacing,
  filterTypography,
} from '@/constants/filter-tokens';

export interface RadiusControlProps {
  value: number;
  onChange: (nextRadiusKm: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function RadiusControl({
  value,
  onChange,
  min = DISCOVERY_MIN_RADIUS_KM,
  max = DISCOVERY_MAX_RADIUS_KM,
  step = DISCOVERY_RADIUS_STEP_KM,
  label = 'Rayon',
  disabled = false,
  disabledReason,
  style,
  testID,
}: RadiusControlProps) {
  const current = clamp(value, min, max);
  const canDecrease = !disabled && current > min;
  const canIncrease = !disabled && current < max;

  const update = (delta: number) => {
    const next = clamp(current + delta, min, max);
    if (next !== current) onChange(next);
  };

  return (
    <View style={[styles.container, disabled && styles.containerDisabled, style]} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, !canDecrease && styles.buttonDisabled]}
          onPress={() => update(-step)}
          disabled={!canDecrease}
          activeOpacity={filterOpacity.pressed}
          accessibilityRole="button"
          accessibilityLabel="Réduire le rayon"
          accessibilityState={{ disabled: !canDecrease }}
          accessibilityHint={disabled ? disabledReason : undefined}
        >
          <Minus size={16} color={filterColors.text} />
        </TouchableOpacity>

        <Text style={styles.value} accessibilityLabel={`Rayon ${formatRadiusLabel(current)}`}>
          {formatRadiusLabel(current)}
        </Text>

        <TouchableOpacity
          style={[styles.button, !canIncrease && styles.buttonDisabled]}
          onPress={() => update(step)}
          disabled={!canIncrease}
          activeOpacity={filterOpacity.pressed}
          accessibilityRole="button"
          accessibilityLabel="Augmenter le rayon"
          accessibilityState={{ disabled: !canIncrease }}
          accessibilityHint={disabled ? disabledReason : undefined}
        >
          <Plus size={16} color={filterColors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: filterSpacing.controlGap,
    minHeight: filterSizing.minTouchTarget,
  },
  containerDisabled: {
    opacity: filterOpacity.disabled,
  },
  label: {
    ...filterTypography.option,
    color: filterColors.text,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: filterSpacing.controlGap,
  },
  button: {
    width: filterSizing.minTouchTarget,
    height: filterSizing.minTouchTarget,
    borderRadius: filterSizing.chipRadius,
    borderWidth: filterSizing.chipBorderWidth,
    borderColor: filterColors.border,
    backgroundColor: filterColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: filterOpacity.disabled,
  },
  value: {
    ...filterTypography.option,
    color: filterColors.text,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'center',
  },
});
