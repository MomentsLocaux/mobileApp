import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Calendar, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Motion, createEnterTiming, createExitTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getCategoryColor } from '@/constants/categories';
import { getCategoryLucideIcon } from '@/constants/category-visuals';
import {
  FilterChip,
  FilterChipRow,
  defaultFilterChipTone,
  type FilterChipRowOption,
} from '@/components/filters';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { activeFilterCount, formatWhenDateRange, type DiscoveryFilters, type DiscoveryWhenFilter } from '@/utils/discovery-filters';
import type { DiscoveryStatus } from '@/constants/filters';
import {
  defaultDiscoveryTemporalFilters,
  filtersForCustomDateRange,
  filtersForSearchTemporalChoice,
  resolveSearchTemporalChoice,
  SEARCH_TEMPORAL_CHOICES,
  type SearchTemporalChoice,
} from '@/utils/search-temporal-choice';
import type { DateRangeValue } from '@/types/eventDate.model';

export type MapViewportFilterDraft = {
  status: DiscoveryStatus;
  when: DiscoveryWhenFilter;
  categories: string[];
  subcategories: string[];
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (draft: MapViewportFilterDraft) => void;
  value: MapViewportFilterDraft;
  searchActive?: boolean;
}

function cloneDraft(value: MapViewportFilterDraft): MapViewportFilterDraft {
  return {
    status: value.status,
    when: { ...value.when },
    categories: [...value.categories],
    subcategories: [...value.subcategories],
  };
}

function draftsEqual(a: MapViewportFilterDraft, b: MapViewportFilterDraft): boolean {
  return (
    a.status === b.status &&
    a.when.preset === b.when.preset &&
    (a.when.startDate || undefined) === (b.when.startDate || undefined) &&
    (a.when.endDate || undefined) === (b.when.endDate || undefined) &&
    Boolean(a.when.includePast) === Boolean(b.when.includePast) &&
    a.categories.join('\0') === b.categories.join('\0') &&
    a.subcategories.join('\0') === b.subcategories.join('\0')
  );
}

function defaultViewportDraft(): MapViewportFilterDraft {
  const next = defaultDiscoveryTemporalFilters();
  return {
    status: next.status,
    when: { ...next.when },
    categories: [],
    subcategories: [],
  };
}

function formatCustomDateLabel(when: DiscoveryWhenFilter): string {
  return formatWhenDateRange(when) ?? 'Choisir les dates…';
}

/** `mapMode` is a display preference and never counts as an active content filter. */
export function hasMapActiveFilters(filters: DiscoveryFilters): boolean {
  return activeFilterCount(filters) > 0;
}

export function MapFiltersSheet({
  visible,
  onClose,
  onApply,
  value,
  searchActive = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<MapViewportFilterDraft>(() => cloneDraft(value));
  const [showRangePicker, setShowRangePicker] = useState(false);
  const progress = useSharedValue(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const mountedRef = useRef(false);
  const categories = useTaxonomyStore((s) => s.categories);
  const taxonomySubcategories = useTaxonomyStore((s) => s.subcategories);

  const unmount = useCallback(() => {
    mountedRef.current = false;
    setMounted(false);
    setShowRangePicker(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setDraft(cloneDraft(valueRef.current));
      mountedRef.current = true;
      setMounted(true);
      cancelAnimation(progress);
      if (reduceMotion) {
        progress.value = 1;
        return;
      }
      progress.value = 0;
      requestAnimationFrame(() => {
        progress.value = withTiming(1, createEnterTiming(Motion.duration.slow));
      });
      return;
    }
    if (!mountedRef.current) return;
    cancelAnimation(progress);
    if (reduceMotion) {
      progress.value = 0;
      unmount();
      return;
    }
    progress.value = withTiming(0, createExitTiming(Motion.duration.normal), (finished) => {
      if (finished) runOnJS(unmount)();
    });
  }, [progress, reduceMotion, unmount, visible]);

  const visibleSubcategories = useMemo(
    () => taxonomySubcategories.filter((sub) => draft.categories.includes(sub.category_id)),
    [draft.categories, taxonomySubcategories]
  );

  const hasCustomDate = Boolean(draft.when.startDate || draft.when.endDate);
  const temporalChoice = resolveSearchTemporalChoice(draft.status, draft.when);
  const isDefaultDraft = draftsEqual(draft, defaultViewportDraft());
  const hasPendingChanges = !draftsEqual(draft, value);

  const temporalOptions = useMemo<FilterChipRowOption<SearchTemporalChoice>[]>(
    () => SEARCH_TEMPORAL_CHOICES.map((item) => ({ key: item.key, label: item.label })),
    []
  );

  const categoryOptions = useMemo<FilterChipRowOption<string>[]>(
    () =>
      categories.map((cat) => {
        const Icon = getCategoryLucideIcon(cat.slug);
        const iconColor = getCategoryColor(cat.id);
        return {
          key: cat.id,
          label: cat.label,
          icon: <Icon size={14} color={iconColor} />,
        };
      }),
    [categories]
  );

  const subcategoryOptions = useMemo<FilterChipRowOption<string>[]>(
    () =>
      visibleSubcategories.map((sub) => ({
        key: sub.id,
        label: sub.label,
      })),
    [visibleSubcategories]
  );

  const allCategoryIds = useMemo(() => categoryOptions.map((item) => item.key), [categoryOptions]);
  const allCategoriesSelected =
    allCategoryIds.length > 0 && draft.categories.length === allCategoryIds.length;

  const handleTemporalChoice = (choice: SearchTemporalChoice) => {
    const next = filtersForSearchTemporalChoice(choice);
    setDraft((current) => ({
      ...current,
      status: next.status,
      when: { ...next.when },
    }));
  };

  const handleCustomDateChange = (range: DateRangeValue) => {
    const next = filtersForCustomDateRange(range);
    setDraft((current) => ({
      ...current,
      status: next.status,
      when: { ...next.when },
    }));
  };

  const handleCategoriesChange = (nextCategories: string[]) => {
    setDraft((current) => ({
      ...current,
      categories: nextCategories,
      subcategories: current.subcategories.filter((subId) => {
        const sub = taxonomySubcategories.find((item) => item.id === subId);
        return sub ? nextCategories.includes(sub.category_id) : false;
      }),
    }));
  };

  const toggleAllCategories = () => {
    if (allCategoriesSelected) {
      setDraft((current) => ({ ...current, categories: [], subcategories: [] }));
      return;
    }
    handleCategoriesChange(allCategoryIds);
  };

  const handleReset = () => {
    setDraft(defaultViewportDraft());
  };

  const handleSave = () => {
    if (hasPendingChanges) onApply(draft);
    onClose();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.28, 1], [0, 1, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [40, 0]) }],
  }));

  if (!mounted) return null;

  return (
    <>
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlayRoot}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <Pressable
          accessibilityLabel="Fermer les filtres"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.sheet,
            { paddingTop: Math.max(insets.top, spacing.md) },
            sheetStyle,
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={18} color={colors.brand.text} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={styles.title}>
              Filtrer les événements
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.hint}>
            {searchActive
              ? 'Affine les événements affichés, sans changer la zone.'
              : 'Ces filtres s’appliquent à la carte et à la liste, sans changer la zone.'}
          </Text>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Par date</Text>
              <FilterChipRow
                accessibilityLabel="Période"
                options={temporalOptions}
                scrollable={false}
                size="sm"
                testID="map-filters-temporal"
                value={hasCustomDate ? null : temporalChoice}
                onChange={(next) => {
                  if (next) handleTemporalChoice(next);
                }}
              >
                <FilterChip
                  accessibilityLabel="Choisir une date précise"
                  active={hasCustomDate}
                  icon={
                    <Calendar
                      color={
                        hasCustomDate
                          ? defaultFilterChipTone.activeTextColor
                          : defaultFilterChipTone.inactiveTextColor
                      }
                      size={14}
                    />
                  }
                  label={formatCustomDateLabel(draft.when)}
                  size="sm"
                  testID="map-filters-custom-date"
                  onPress={() => setShowRangePicker(true)}
                />
              </FilterChipRow>
            </View>

            {categoryOptions.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Par intérêts</Text>
                  <TouchableOpacity
                    accessibilityLabel={
                      allCategoriesSelected ? 'Tout désélectionner' : 'Tout sélectionner'
                    }
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={toggleAllCategories}
                  >
                    <Text style={styles.selectAllText}>
                      {allCategoriesSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <FilterChipRow
                  accessibilityLabel="Catégories"
                  mode="multi"
                  options={categoryOptions}
                  scrollable={false}
                  size="sm"
                  testID="map-filters-categories"
                  values={draft.categories}
                  onChange={handleCategoriesChange}
                />
              </View>
            ) : null}

            {subcategoryOptions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Préciser</Text>
                <FilterChipRow
                  accessibilityLabel="Sous-catégories"
                  mode="multi"
                  options={subcategoryOptions}
                  scrollable={false}
                  size="sm"
                  values={draft.subcategories}
                  onChange={(next) =>
                    setDraft((current) => ({ ...current, subcategories: next }))
                  }
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <TouchableOpacity
              accessibilityLabel="Réinitialiser les filtres"
              accessibilityRole="button"
              disabled={isDefaultDraft}
              onPress={handleReset}
              style={styles.resetButton}
            >
              <Text style={[styles.resetText, isDefaultDraft && styles.resetTextDisabled]}>
                Réinitialiser
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Enregistrer les filtres"
              accessibilityRole="button"
              activeOpacity={0.9}
              onPress={handleSave}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
    <DateRangePicker
      context="search"
      mode="range"
      open={showRangePicker}
      value={{
        startDate: draft.when.startDate || null,
        endDate: draft.when.endDate || null,
      }}
      onChange={handleCustomDateChange}
      onClose={() => setShowRangePicker(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 51, 41, 0.35)',
  },
  sheet: {
    position: 'absolute',
    top: 8,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    ...typography.subtitle,
    color: colors.brand.text,
    flex: 1,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  selectAllText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
    backgroundColor: colors.brand.page,
  },
  resetButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  resetText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  resetTextDisabled: {
    opacity: 0.4,
  },
  saveButton: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...typography.body,
    color: colors.brand.onAccent,
    fontWeight: '700',
  },
});
