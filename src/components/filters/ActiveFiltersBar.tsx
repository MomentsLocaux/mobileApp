import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { filterColors, filterSpacing, filterTypography } from '@/constants/filter-tokens';
import { borderRadius, spacing } from '@/constants/theme';

export type ActiveFilterChip = {
  key: string;
  label: string;
  onClear: () => void;
};

export interface ActiveFiltersBarProps {
  chips: ActiveFilterChip[];
  onClearAll?: () => void;
  clearAllLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Removable chips summarizing active discovery filters (search, status, etc.). */
export function ActiveFiltersBar({
  chips,
  onClearAll,
  clearAllLabel = 'Tout effacer',
  style,
  testID,
}: ActiveFiltersBarProps) {
  if (chips.length === 0) return null;

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {chips.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={styles.chip}
            onPress={chip.onClear}
            accessibilityRole="button"
            accessibilityLabel={`Retirer le filtre ${chip.label}`}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {chip.label}
            </Text>
            <X size={14} color={filterColors.chipActiveText} />
          </TouchableOpacity>
        ))}
        {onClearAll ? (
          <TouchableOpacity
            style={styles.clearAll}
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel={clearAllLabel}
          >
            <Text style={styles.clearAllText}>{clearAllLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: filterSpacing.chipGap,
    paddingHorizontal: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: filterColors.chipActiveBackground,
    borderWidth: 1,
    borderColor: filterColors.chipActiveBorder,
    maxWidth: 220,
  },
  chipText: {
    ...filterTypography.chip,
    color: filterColors.chipActiveText,
    flexShrink: 1,
  },
  clearAll: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearAllText: {
    ...filterTypography.chip,
    color: filterColors.accent,
    fontWeight: '700',
  },
});
