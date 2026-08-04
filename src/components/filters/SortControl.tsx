import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import type { SortOption, SortOrder } from '@/types/filters';
import {
  DISTANCE_DISABLED_REASON,
  SORT_LABELS,
  SORT_OPTIONS,
  defaultSortOrderFor,
  isOrderableSort,
  sortOrderLabel,
} from '@/constants/filters';
import {
  filterColors,
  filterOpacity,
  filterSizing,
  filterSpacing,
  filterTypography,
} from '@/constants/filter-tokens';
import { borderRadius } from '@/constants/theme';
import { FilterChipRow } from './FilterChipRow';

export type SortControlMode = 'pill' | 'iconOnly' | 'list';

export interface SortControlProps {
  value: SortOption;
  onChange: (next: SortOption) => void;
  sortOrder?: SortOrder;
  onSortOrderChange?: (next: SortOrder) => void;
  /** Distance sorting requires a center; without it the option is disabled. */
  hasLocation?: boolean;
  mode?: SortControlMode;
  options?: readonly SortOption[];
  title?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SortControl({
  value,
  onChange,
  sortOrder,
  onSortOrderChange,
  hasLocation = false,
  mode = 'pill',
  options = SORT_OPTIONS,
  title = 'Trier par',
  hint,
  style,
  testID,
}: SortControlProps) {
  const [open, setOpen] = useState(false);
  const showOrder = isOrderableSort(value) && Boolean(onSortOrderChange);

  const isDisabled = useCallback(
    (option: SortOption) => option === 'distance' && !hasLocation,
    [hasLocation]
  );

  const select = useCallback(
    (option: SortOption) => {
      if (isDisabled(option)) return;
      onChange(option);
      if (isOrderableSort(option) && !sortOrder) {
        onSortOrderChange?.(defaultSortOrderFor(option));
      }
    },
    [isDisabled, onChange, onSortOrderChange, sortOrder]
  );

  const orderRow = useMemo(() => {
    if (!showOrder || !onSortOrderChange) return null;
    return (
      <FilterChipRow
        options={(['asc', 'desc'] as const).map((order) => ({
          key: order,
          label: sortOrderLabel(order),
        }))}
        value={sortOrder ?? null}
        onChange={(next) => {
          if (next) onSortOrderChange(next);
        }}
        scrollable={false}
        style={styles.orderRow}
        accessibilityLabel="Ordre de tri"
      />
    );
  }, [onSortOrderChange, showOrder, sortOrder]);

  const renderOptions = (afterSelect?: () => void) => (
    <View style={styles.optionList}>
      {options.map((option) => {
        const disabled = isDisabled(option);
        const selected = value === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.option, disabled && styles.optionDisabled]}
            onPress={() => {
              select(option);
              afterSelect?.();
            }}
            disabled={disabled}
            activeOpacity={filterOpacity.pressed}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={SORT_LABELS[option]}
            accessibilityHint={disabled ? DISTANCE_DISABLED_REASON : undefined}
          >
            <Text style={[styles.optionText, selected && styles.optionTextActive]}>
              {SORT_LABELS[option]}
            </Text>
            {disabled ? <Text style={styles.optionReason}>{DISTANCE_DISABLED_REASON}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (mode === 'list') {
    return (
      <View style={style} testID={testID}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {renderOptions()}
        {orderRow}
      </View>
    );
  }

  const showLabel = mode === 'pill';
  const triggerLabel = `${SORT_LABELS[value]}${
    showOrder && sortOrder ? ` · ${sortOrderLabel(sortOrder)}` : ''
  }`;

  return (
    <>
      <TouchableOpacity
        style={[styles.pill, !showLabel && styles.pillIconOnly, style]}
        onPress={() => setOpen(true)}
        activeOpacity={filterOpacity.pressed}
        accessibilityRole="button"
        accessibilityLabel={`Trier par ${SORT_LABELS[value]}`}
        testID={testID}
      >
        <SlidersHorizontal size={16} color={filterColors.text} />
        {showLabel ? (
          <Text style={styles.pillText} numberOfLines={1}>
            {triggerLabel}
          </Text>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.overlay}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Fermer le tri"
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          {renderOptions(() => setOpen(false))}
          {orderRow}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: filterSpacing.chipGap,
    paddingHorizontal: filterSizing.chipPaddingHorizontal,
    minHeight: filterSizing.compactChipHeight,
    borderRadius: filterSizing.chipRadius,
    borderWidth: filterSizing.chipBorderWidth,
    borderColor: filterColors.border,
    backgroundColor: filterColors.surface,
  },
  pillIconOnly: {
    width: filterSizing.minTouchTarget,
    height: filterSizing.minTouchTarget,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  pillText: {
    ...filterTypography.chip,
    color: filterColors.text,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    backgroundColor: filterColors.background,
    paddingHorizontal: filterSpacing.rowPaddingHorizontal,
    paddingTop: filterSpacing.rowPaddingHorizontal,
    paddingBottom: filterSpacing.rowPaddingHorizontal,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  title: {
    ...filterTypography.sectionTitle,
    color: filterColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: filterSpacing.sectionGap,
  },
  hint: {
    ...filterTypography.sectionHint,
    color: filterColors.textSecondary,
    marginBottom: filterSpacing.sectionGap,
    lineHeight: 18,
  },
  optionList: {
    gap: filterSpacing.sectionGap,
  },
  option: {
    minHeight: filterSizing.minTouchTarget,
    justifyContent: 'center',
  },
  optionDisabled: {
    opacity: filterOpacity.disabled,
  },
  optionText: {
    ...filterTypography.option,
    color: filterColors.textSecondary,
  },
  optionTextActive: {
    color: filterColors.accent,
    fontWeight: '700',
  },
  optionReason: {
    ...filterTypography.sectionHint,
    color: filterColors.textSecondary,
  },
  orderRow: {
    marginTop: filterSpacing.controlGap,
  },
});
