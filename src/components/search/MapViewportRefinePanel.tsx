import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { FilterChip, FilterChipRow, type FilterChipRowOption } from '@/components/filters';
import { DateRangePicker } from '@/components/DateRangePicker';
import {
  createFilterChipTone,
  defaultFilterChipTone,
  filterDenseHitSlop,
  filterTypography,
} from '@/constants/filter-tokens';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventMetaFilter } from '@/utils/filter-events';
import { formatWhenDateRange, type DiscoveryWhenFilter } from '@/utils/discovery-filters';
import type { DateRangeValue } from '@/types/eventDate.model';
import {
  isDefaultDiscoveryTemporal,
  resolveSearchTemporalChoice,
  SEARCH_TEMPORAL_CHOICES,
  type SearchTemporalChoice,
} from '@/utils/search-temporal-choice';

type Props = {
  visible: boolean;
  searchActive: boolean;
  metaFilter: EventMetaFilter;
  when: DiscoveryWhenFilter;
  selectedCategories: string[];
  selectedSubcategories: string[];
  onTemporalChoice: (choice: SearchTemporalChoice) => void;
  onCustomDateChange: (range: DateRangeValue) => void;
  onCategoriesChange: (categories: string[], subcategories: string[]) => void;
  onClear?: () => void;
};

function formatCustomDateLabel(when: DiscoveryWhenFilter): string {
  return formatWhenDateRange(when) ?? 'Date précise';
}

export function MapViewportRefinePanel({
  visible,
  searchActive,
  metaFilter,
  when,
  selectedCategories,
  selectedSubcategories,
  onTemporalChoice,
  onCustomDateChange,
  onCategoriesChange,
  onClear,
}: Props) {
  const categories = useTaxonomyStore((s) => s.categories);
  const taxonomySubcategories = useTaxonomyStore((s) => s.subcategories);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const hasCustomDate = Boolean(when.startDate || when.endDate);
  const temporalChoice = resolveSearchTemporalChoice(metaFilter, when);
  const hasRefine =
    selectedCategories.length > 0 || !isDefaultDiscoveryTemporal(metaFilter, when);

  const temporalOptions = useMemo<FilterChipRowOption<SearchTemporalChoice>[]>(
    () => SEARCH_TEMPORAL_CHOICES.map((item) => ({ key: item.key, label: item.label })),
    []
  );

  const categoryOptions = useMemo<FilterChipRowOption<string>[]>(
    () =>
      categories.map((cat) => ({
        key: cat.id,
        label: cat.label,
        tone: createFilterChipTone(getCategoryColor(cat.id), getCategoryTextColor(cat.id)),
      })),
    [categories]
  );

  const allCategoryIds = useMemo(() => categoryOptions.map((item) => item.key), [categoryOptions]);
  const allCategoriesSelected =
    allCategoryIds.length > 0 && selectedCategories.length === allCategoryIds.length;

  const handleCategoryChipsChange = useCallback(
    (nextCategories: string[]) => {
      const nextSubcategories = selectedSubcategories.filter((subId) => {
        const sub = taxonomySubcategories.find((item) => item.id === subId);
        return sub ? nextCategories.includes(sub.category_id) : false;
      });
      onCategoriesChange(nextCategories, nextSubcategories);
    },
    [onCategoriesChange, selectedSubcategories, taxonomySubcategories]
  );

  const toggleAllCategories = useCallback(() => {
    if (allCategoriesSelected) {
      onCategoriesChange([], []);
      return;
    }
    const nextSubcategories = selectedSubcategories.filter((subId) => {
      const sub = taxonomySubcategories.find((item) => item.id === subId);
      return sub ? allCategoryIds.includes(sub.category_id) : false;
    });
    onCategoriesChange(allCategoryIds, nextSubcategories);
  }, [
    allCategoriesSelected,
    allCategoryIds,
    onCategoriesChange,
    selectedSubcategories,
    taxonomySubcategories,
  ]);

  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.hint}>
        {searchActive
          ? 'Affine les événements affichés, sans changer la zone.'
          : 'Affine les événements de la zone visible.'}
      </Text>
      <FilterChipRow
        options={temporalOptions}
        value={hasCustomDate ? null : temporalChoice}
        onChange={(next) => {
          if (next) onTemporalChoice(next);
        }}
        size="xs"
        accessibilityLabel="Période"
        testID="map-refine-temporal-filters"
      >
        <FilterChip
          label={formatCustomDateLabel(when)}
          active={hasCustomDate}
          size="xs"
          icon={
            <Calendar
              size={11}
              color={
                hasCustomDate
                  ? defaultFilterChipTone.activeTextColor
                  : defaultFilterChipTone.inactiveTextColor
              }
            />
          }
          onPress={() => setShowRangePicker(true)}
          accessibilityLabel="Choisir une date précise"
          testID="map-refine-custom-date"
        />
      </FilterChipRow>
      {categoryOptions.length > 0 ? (
        <>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>Catégories</Text>
            <TouchableOpacity
              onPress={toggleAllCategories}
              accessibilityRole="button"
              accessibilityLabel={
                allCategoriesSelected ? 'Tout désélectionner' : 'Tout sélectionner'
              }
              hitSlop={filterDenseHitSlop}
              style={styles.selectAllButton}
            >
              <Text style={styles.selectAllText}>
                {allCategoriesSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Text>
            </TouchableOpacity>
          </View>
          <FilterChipRow
            mode="multi"
            options={categoryOptions}
            values={selectedCategories}
            onChange={handleCategoryChipsChange}
            size="xs"
            accessibilityLabel="Catégories"
            testID="map-refine-category-filters"
          />
        </>
      ) : null}
      {hasRefine && onClear ? (
        <TouchableOpacity
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Effacer les filtres"
          hitSlop={filterDenseHitSlop}
          style={styles.clearButton}
        >
          <Text style={styles.clearText}>Effacer les filtres</Text>
        </TouchableOpacity>
      ) : null}
      <DateRangePicker
        open={showRangePicker}
        mode="range"
        value={{
          startDate: when.startDate || null,
          endDate: when.endDate || null,
        }}
        onChange={onCustomDateChange}
        onClose={() => setShowRangePicker(false)}
        context="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 2,
  },
  hint: {
    ...filterTypography.chipDense,
    fontWeight: '400',
    color: colors.brand.textSecondary,
    paddingHorizontal: spacing.xs,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: 2,
    minHeight: 28,
  },
  categoryTitle: {
    ...filterTypography.chipDense,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  selectAllButton: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  selectAllText: {
    ...filterTypography.chipDense,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  clearButton: {
    minHeight: 28,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
  },
  clearText: {
    ...filterTypography.chipDense,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
});
