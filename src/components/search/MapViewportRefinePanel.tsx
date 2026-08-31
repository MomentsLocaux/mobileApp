import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { FilterChip, FilterChipRow, type FilterChipRowOption } from '@/components/filters';
import { DateRangePicker } from '@/components/DateRangePicker';
import { createFilterChipTone, defaultFilterChipTone } from '@/constants/filter-tokens';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventMetaFilter } from '@/utils/filter-events';
import type { DiscoveryWhenFilter } from '@/utils/discovery-filters';
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
  if (!when.startDate && !when.endDate) return 'Date précise';
  const format = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };
  if (when.startDate && when.endDate && when.startDate !== when.endDate) {
    return `${format(when.startDate)}–${format(when.endDate)}`;
  }
  return format(when.startDate || when.endDate || '');
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
        size="sm"
        style={styles.row}
        accessibilityLabel="Période"
        testID="map-refine-temporal-filters"
      >
        <FilterChip
          label={formatCustomDateLabel(when)}
          active={hasCustomDate}
          size="sm"
          icon={
            <Calendar
              size={12}
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
            size="sm"
            style={styles.row}
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
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  row: {
    marginTop: spacing.xs,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  categoryTitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  selectAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  selectAllText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  clearButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
  },
  clearText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
});
