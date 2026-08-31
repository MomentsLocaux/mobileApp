import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusFilterRow, FilterChipRow, type FilterChipRowOption } from '@/components/filters';
import { createFilterChipTone } from '@/constants/filter-tokens';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { DEFAULT_DISCOVERY_STATUS } from '@/constants/filters';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventMetaFilter } from '@/utils/filter-events';

type Props = {
  visible: boolean;
  searchActive: boolean;
  metaFilter: EventMetaFilter;
  selectedCategories: string[];
  selectedSubcategories: string[];
  onMetaFilterChange: (filter: EventMetaFilter) => void;
  onCategoriesChange: (categories: string[], subcategories: string[]) => void;
  onClear?: () => void;
};

export function MapViewportRefinePanel({
  visible,
  searchActive,
  metaFilter,
  selectedCategories,
  selectedSubcategories,
  onMetaFilterChange,
  onCategoriesChange,
  onClear,
}: Props) {
  const categories = useTaxonomyStore((s) => s.categories);
  const taxonomySubcategories = useTaxonomyStore((s) => s.subcategories);
  const hasRefine =
    selectedCategories.length > 0 || metaFilter !== DEFAULT_DISCOVERY_STATUS;

  const categoryOptions = useMemo<FilterChipRowOption<string>[]>(
    () =>
      categories.map((cat) => ({
        key: cat.id,
        label: cat.label,
        tone: createFilterChipTone(getCategoryColor(cat.id), getCategoryTextColor(cat.id)),
      })),
    [categories]
  );

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

  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.hint}>
        {searchActive
          ? 'Affine les événements affichés, sans changer la zone.'
          : 'Affine les événements de la zone visible.'}
      </Text>
      <StatusFilterRow
        value={metaFilter}
        onChange={onMetaFilterChange}
        size="sm"
        style={styles.row}
        testID="map-refine-status-filters"
      />
      {categoryOptions.length > 0 ? (
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
