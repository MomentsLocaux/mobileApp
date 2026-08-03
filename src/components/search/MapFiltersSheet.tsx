import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventMetaFilter } from '@/utils/filter-events';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Motion, createEnterTiming, createExitTiming } from '@/constants/motion';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { filterColors } from '@/constants/filter-tokens';
import {
  DEFAULT_SORT_OPTION,
  MAP_MODES,
  type DatePreset,
  type MapMode,
} from '@/constants/filters';
import {
  activeFilterCount,
  summarize,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';
import {
  FilterChipRow,
  FilterSection,
  StatusFilterRow,
  WhenPresets,
  createFilterChipTone,
  type FilterChipRowOption,
} from '@/components/filters';
import { useTaxonomyStore } from '@/store/taxonomyStore';

/** Discovery filter values owned by the map screen (sort excluded from the sheet UI). */
export interface MapFiltersSnapshot {
  metaFilter: EventMetaFilter;
  mapMode: MapMode;
  sortBy: SortOption;
  sortOrder?: SortOrder;
  whenPreset?: DatePreset;
  categoryIds?: string[];
  subcategoryIds?: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<View | null>;
  metaFilter: EventMetaFilter;
  onMetaFilterChange: (filter: EventMetaFilter) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  searchActive: boolean;
  sortBy: SortOption;
  sortOrder?: SortOrder;
  whenPreset?: DatePreset;
  onWhenPresetChange: (preset?: DatePreset) => void;
  selectedCategories: string[];
  selectedSubcategories: string[];
  onCategoriesChange: (categories: string[], subcategories: string[]) => void;
  onReset: () => void;
  resultCount: number;
  isLoadingResults?: boolean;
}

function formatResultsButtonLabel(count: number, isLoading = false): string {
  if (isLoading) return 'Chargement…';
  if (count <= 0) return 'Afficher les 0 événements';
  if (count === 1) return "Afficher l'événement";
  return `Afficher les ${count} événements`;
}

/** Projects the map screen state onto the shared discovery filter model. */
export function buildMapDiscoveryFilters(snapshot: MapFiltersSnapshot): DiscoveryFilters {
  return {
    status: snapshot.metaFilter,
    when: { preset: snapshot.whenPreset },
    place: {},
    content: {
      categories: snapshot.categoryIds ?? [],
      subcategories: snapshot.subcategoryIds ?? [],
      tags: [],
    },
    sort: {
      home: { sortBy: DEFAULT_SORT_OPTION },
      map: { sortBy: snapshot.sortBy, sortOrder: snapshot.sortOrder },
    },
    mapMode: snapshot.mapMode,
  };
}

/** `mapMode` is a display preference and never counts as an active content filter. */
export function hasMapActiveFilters(snapshot: MapFiltersSnapshot): boolean {
  return activeFilterCount(buildMapDiscoveryFilters(snapshot), { surface: 'map' }) > 0;
}

export function MapFiltersSheet({
  visible,
  onClose,
  anchorRef,
  metaFilter,
  onMetaFilterChange,
  mapMode,
  onMapModeChange,
  searchActive,
  sortBy,
  sortOrder,
  whenPreset,
  onWhenPresetChange,
  selectedCategories,
  selectedSubcategories,
  onCategoriesChange,
  onReset,
  resultCount,
  isLoadingResults = false,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [overlayMounted, setOverlayMounted] = useState(false);
  const progress = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromW = useSharedValue(44);
  const fromH = useSharedValue(44);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);

  const visibleSubcategories = useMemo(
    () => subcategories.filter((sub) => selectedCategories.includes(sub.category_id)),
    [selectedCategories, subcategories]
  );

  const resultsButtonLabel = useMemo(
    () => formatResultsButtonLabel(resultCount, isLoadingResults),
    [isLoadingResults, resultCount]
  );

  const discoveryFilters = useMemo(
    () =>
      buildMapDiscoveryFilters({
        metaFilter,
        mapMode,
        sortBy,
        sortOrder,
        whenPreset,
        categoryIds: selectedCategories,
        subcategoryIds: selectedSubcategories,
      }),
    [mapMode, metaFilter, selectedCategories, selectedSubcategories, sortBy, sortOrder, whenPreset]
  );

  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    categories.forEach((cat) => {
      labels[cat.id] = cat.label;
    });
    subcategories.forEach((sub) => {
      labels[sub.id] = sub.label;
    });
    return labels;
  }, [categories, subcategories]);

  const summaryLabel = useMemo(
    () => summarize(discoveryFilters, { surface: 'map', categoryLabels, includeMapMode: true }),
    [categoryLabels, discoveryFilters]
  );

  const canReset = useMemo(
    () => activeFilterCount(discoveryFilters, { surface: 'map' }) > 0,
    [discoveryFilters]
  );

  const searchHint = useMemo(() => {
    if (searchActive) return undefined;
    return metaFilter !== 'all'
      ? 'Les critères de recherche avancés sont actifs uniquement avec le statut « Tous ».'
      : 'Pour lieu, dates précises ou texte libre, utilisez la barre de recherche.';
  }, [metaFilter, searchActive]);

  const categoryOptions = useMemo<FilterChipRowOption<string>[]>(
    () =>
      categories.map((cat) => ({
        key: cat.id,
        label: cat.label,
        tone: createFilterChipTone(getCategoryColor(cat.id), getCategoryTextColor(cat.id)),
      })),
    [categories]
  );

  const subcategoryOptions = useMemo<FilterChipRowOption<string>[]>(
    () =>
      visibleSubcategories.map((sub) => ({
        key: sub.id,
        label: sub.label,
        tone: createFilterChipTone(
          getCategoryColor(sub.category_id),
          getCategoryTextColor(sub.category_id)
        ),
      })),
    [visibleSubcategories]
  );

  const handleCategoriesChange = (nextCategories: string[]) => {
    const nextSubcategories = selectedSubcategories.filter((subId) => {
      const sub = subcategories.find((item) => item.id === subId);
      return sub ? nextCategories.includes(sub.category_id) : false;
    });
    onCategoriesChange(nextCategories, nextSubcategories);
  };

  useEffect(() => {
    if (visible) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      const open = () => {
        setOverlayMounted(true);
        progress.value = 0;
        contentProgress.value = 0;
        progress.value = withTiming(1, createEnterTiming(Motion.duration.slow));
        contentProgress.value = withDelay(
          Motion.duration.micro,
          withTiming(1, createEnterTiming(Motion.duration.fast))
        );
      };

      if (anchorRef?.current) {
        (anchorRef.current as View).measureInWindow((x, y, width, height) => {
          fromX.value = x;
          fromY.value = y;
          fromW.value = width;
          fromH.value = height;
          open();
        });
      } else {
        fromX.value = screenWidth - 60;
        fromY.value = 80;
        fromW.value = 44;
        fromH.value = 44;
        open();
      }
      return;
    }

    progress.value = withTiming(0, createExitTiming(Motion.duration.fast));
    contentProgress.value = withTiming(0, { duration: Motion.duration.micro });
    closeTimeoutRef.current = setTimeout(() => {
      setOverlayMounted(false);
    }, Motion.duration.fast + 40);
  }, [
    anchorRef,
    contentProgress,
    fromH,
    fromW,
    fromX,
    fromY,
    progress,
    screenHeight,
    screenWidth,
    visible,
  ]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    },
    []
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const left = interpolate(progress.value, [0, 1], [fromX.value, 0], Extrapolate.CLAMP);
    const top = interpolate(progress.value, [0, 1], [fromY.value, 0], Extrapolate.CLAMP);
    const width = interpolate(progress.value, [0, 1], [fromW.value, screenWidth], Extrapolate.CLAMP);
    const height = interpolate(progress.value, [0, 1], [fromH.value, screenHeight], Extrapolate.CLAMP);
    const radius = interpolate(progress.value, [0, 1], [22, 0], Extrapolate.CLAMP);
    return {
      left,
      top,
      width,
      height,
      borderRadius: radius,
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      {
        translateY: interpolate(contentProgress.value, [0, 1], [12, 0], Extrapolate.CLAMP),
      },
    ],
  }));

  if (!overlayMounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlayRoot}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <Pressable style={styles.backdropPressable} onPress={onClose} />
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <Animated.View style={[styles.sheetInner, contentStyle]}>
            <View style={styles.header}>
              <Text style={styles.title}>Filtres</Text>
              <View style={styles.headerActions}>
                {canReset ? (
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={onReset}
                    accessibilityRole="button"
                    accessibilityLabel="Réinitialiser les filtres"
                  >
                    <Text style={styles.resetText}>Tout effacer</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                >
                  <X size={20} color={colors.brand.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.summary}>{summaryLabel}</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <FilterSection title="Statut des événements">
                <StatusFilterRow
                  value={metaFilter}
                  onChange={onMetaFilterChange}
                  scrollable={false}
                />
              </FilterSection>

              <FilterSection title="Quand" hint={searchHint}>
                <WhenPresets
                  value={whenPreset ?? null}
                  onChange={(next) => onWhenPresetChange(next ?? undefined)}
                  status={metaFilter}
                  scrollable={false}
                />
              </FilterSection>

              <FilterSection title="Catégories">
                <FilterChipRow
                  mode="multi"
                  options={categoryOptions}
                  values={selectedCategories}
                  onChange={handleCategoriesChange}
                  scrollable={false}
                  accessibilityLabel="Catégories"
                />
              </FilterSection>

              {subcategoryOptions.length > 0 ? (
                <FilterSection title="Sous-catégories">
                  <FilterChipRow
                    mode="multi"
                    options={subcategoryOptions}
                    values={selectedSubcategories}
                    onChange={(next) => onCategoriesChange(selectedCategories, next)}
                    scrollable={false}
                    accessibilityLabel="Sous-catégories"
                  />
                </FilterSection>
              ) : null}

              <FilterSection title="Style de carte" hint="Préférence d'affichage de la carte.">
                <FilterChipRow
                  options={MAP_MODES}
                  value={mapMode}
                  onChange={(next) => {
                    if (next) onMapModeChange(next);
                  }}
                  scrollable={false}
                  accessibilityLabel="Style de carte"
                />
              </FilterSection>
            </ScrollView>

            <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.9}>
              <Text style={styles.doneButtonText}>{resultsButtonLabel}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    backgroundColor: colors.brand.primary,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.brand.text,
  },
  resetButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  resetText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summary: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  doneButton: {
    marginTop: spacing.md,
    backgroundColor: colors.brand.secondary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.body,
    color: filterColors.onAccent,
    fontWeight: '700',
  },
});
