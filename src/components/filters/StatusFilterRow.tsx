import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { META_FILTERS, type DiscoveryStatus } from '@/constants/filters';
import { FilterChipRow, type FilterChipRowOption } from './FilterChipRow';
import type { FilterChipSize } from './FilterChip';

export interface StatusFilterRowProps {
  value: DiscoveryStatus;
  onChange: (next: DiscoveryStatus) => void;
  /** Statuses to hide on a given surface (e.g. `past` while a search is running). */
  hiddenStatuses?: readonly DiscoveryStatus[];
  disabledStatuses?: Partial<Record<DiscoveryStatus, string>>;
  scrollable?: boolean;
  size?: FilterChipSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StatusFilterRow({
  value,
  onChange,
  hiddenStatuses,
  disabledStatuses,
  scrollable = true,
  size = 'sm',
  style,
  testID,
}: StatusFilterRowProps) {
  const options = useMemo<FilterChipRowOption<DiscoveryStatus>[]>(
    () =>
      META_FILTERS.filter((item) => !hiddenStatuses?.includes(item.key)).map((item) => {
        const disabledReason = disabledStatuses?.[item.key];
        return {
          key: item.key,
          label: item.label,
          disabled: Boolean(disabledReason),
          disabledReason,
        };
      }),
    [disabledStatuses, hiddenStatuses]
  );

  return (
    <FilterChipRow
      options={options}
      value={value}
      onChange={(next) => {
        if (next) onChange(next);
      }}
      scrollable={scrollable}
      size={size}
      style={style}
      accessibilityLabel="Statut des événements"
      testID={testID}
    />
  );
}
