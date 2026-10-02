import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  defaultFilterChipTone,
  filterHitSlop,
  filterDenseHitSlop,
  filterOpacity,
  filterSizing,
  filterTypography,
  type FilterChipTone,
} from '@/constants/filter-tokens';

export type FilterChipSize = 'xs' | 'sm' | 'md';

export interface FilterChipProps {
  label: string;
  /** Secondary line under the label, for ranges that should stay readable but quiet. */
  caption?: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Announced as an accessibility hint and surfaced by parent rows when disabled. */
  disabledReason?: string;
  tone?: FilterChipTone;
  /** `xs` is reserved for dense overlays (map refine). Home/search keep `sm`. */
  size?: FilterChipSize;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FilterChip({
  label,
  caption,
  active = false,
  onPress,
  disabled = false,
  disabledReason,
  tone = defaultFilterChipTone,
  size = 'sm',
  icon,
  accessibilityLabel,
  style,
  testID,
}: FilterChipProps) {
  const isDense = size === 'xs';
  const isComfortable = size === 'md';
  const containerStyle = useMemo<ViewStyle>(
    () => ({
      minHeight: isComfortable
        ? filterSizing.minTouchTarget
        : isDense
          ? filterSizing.denseChipHeight
          : filterSizing.compactChipHeight,
      paddingVertical: isComfortable
        ? filterSizing.chipPaddingVertical
        : isDense
          ? filterSizing.denseChipPaddingVertical
          : filterSizing.chipCompactPaddingVertical,
      paddingHorizontal: isDense
        ? filterSizing.denseChipPaddingHorizontal
        : filterSizing.chipPaddingHorizontal,
      gap: isDense ? 4 : 6,
      backgroundColor: active ? tone.activeBackgroundColor : tone.inactiveBackgroundColor,
      borderColor: active ? tone.activeBorderColor : tone.inactiveBorderColor,
      opacity: disabled ? filterOpacity.disabled : 1,
    }),
    [active, disabled, isComfortable, isDense, tone]
  );

  return (
    <TouchableOpacity
      style={[styles.chip, containerStyle, style]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={filterOpacity.pressed}
      hitSlop={isComfortable ? undefined : isDense ? filterDenseHitSlop : filterHitSlop}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel ?? (caption ? `${label}, ${caption}` : label)}
      accessibilityHint={disabled ? disabledReason : undefined}
      testID={testID}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text
          style={[
            styles.label,
            isDense ? filterTypography.chipDense : null,
            { color: active ? tone.activeTextColor : tone.inactiveTextColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {caption ? (
          <Text
            style={[
              styles.caption,
              { color: active ? tone.activeTextColor : tone.inactiveTextColor },
            ]}
            numberOfLines={1}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: filterSizing.chipPaddingHorizontal,
    borderRadius: filterSizing.chipRadius,
    borderWidth: filterSizing.chipBorderWidth,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
  },
  label: {
    ...filterTypography.chip,
    fontWeight: '600',
  },
  caption: {
    fontFamily: filterTypography.chip.fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    opacity: 0.75,
  },
});
