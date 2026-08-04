import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  DATE_PRESETS,
  WHEN_DISABLED_WHEN_PAST_REASON,
  type DatePreset,
  type DiscoveryStatus,
} from '@/constants/filters';
import { filterColors, filterSpacing, filterTypography } from '@/constants/filter-tokens';
import { FilterChipRow, type FilterChipRowOption } from './FilterChipRow';
import type { FilterChipSize } from './FilterChip';

export interface WhenPresetsProps {
  value?: DatePreset | null;
  onChange: (next: DatePreset | null) => void;
  /** Convenience: `past` disables the presets since they describe now/future. */
  status?: DiscoveryStatus;
  /** Explicit override; wins over the `status` heuristic. */
  disabled?: boolean;
  disabledReason?: string;
  /** Renders the reason below the row instead of only exposing it to a11y. */
  showDisabledReason?: boolean;
  scrollable?: boolean;
  size?: FilterChipSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function WhenPresets({
  value,
  onChange,
  status,
  disabled,
  disabledReason,
  showDisabledReason = true,
  scrollable = true,
  size = 'sm',
  style,
  testID,
}: WhenPresetsProps) {
  const isDisabled = disabled ?? status === 'past';
  const reason = disabledReason ?? (status === 'past' ? WHEN_DISABLED_WHEN_PAST_REASON : undefined);

  const options = useMemo<FilterChipRowOption<DatePreset>[]>(
    () =>
      DATE_PRESETS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: isDisabled,
        disabledReason: reason,
      })),
    [isDisabled, reason]
  );

  return (
    <View style={style}>
      <FilterChipRow
        options={options}
        value={value ?? null}
        allowDeselect
        onChange={onChange}
        scrollable={scrollable}
        size={size}
        accessibilityLabel="Dates rapides"
        testID={testID}
      />
      {isDisabled && showDisabledReason && reason ? (
        <Text style={styles.reason}>{reason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  reason: {
    ...filterTypography.sectionHint,
    color: filterColors.textSecondary,
    marginTop: filterSpacing.sectionGap,
    lineHeight: 18,
  },
});
