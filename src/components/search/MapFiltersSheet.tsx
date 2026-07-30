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
import { useTaxonomyStore } from '@/store/taxonomyStore';

const META_FILTERS: { key: EventMetaFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'live', label: 'En cours' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passés' },
];

const MAP_MODES: { key: 'standard' | 'satellite'; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'satellite', label: 'Satellite' },
];

const DATE_PRESETS: { key: 'today' | 'tomorrow' | 'weekend'; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'weekend', label: 'Ce week-end' },
];

const SORT_LABELS: Record<SortOption, string> = {
  triage: 'Pertinence',
  date: 'Date début',
  endDate: 'Date fin',
  created: 'Date création',
  distance: 'Distance',
  popularity: 'Popularité',
};

const SORT_OPTIONS: SortOption[] = ['triage', 'date', 'endDate', 'created', 'distance', 'popularity'];

const withAlpha = (hexColor: string, alphaHex: string) => `${hexColor}${alphaHex}`;

interface Props {
  visible: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<View | null>;
  metaFilter: EventMetaFilter;
  onMetaFilterChange: (filter: EventMetaFilter) => void;
  mapMode: 'standard' | 'satellite';
  onMapModeChange: (mode: 'standard' | 'satellite') => void;
  searchActive: boolean;
  sortBy: SortOption;
  sortOrder?: SortOrder;
  onSortByChange: (value: SortOption) => void;
  onSortOrderChange: (order: SortOrder) => void;
  hasLocation: boolean;
  whenPreset?: 'today' | 'tomorrow' | 'weekend';
  onWhenPresetChange: (preset?: 'today' | 'tomorrow' | 'weekend') => void;
  selectedCategories: string[];
  selectedSubcategories: string[];
  onCategoriesChange: (categories: string[], subcategories: string[]) => void;
  resultCount: number;
  isLoadingResults?: boolean;
}

function formatResultsButtonLabel(count: number, isLoading = false): string {
  if (isLoading) return 'Chargement…';
  if (count <= 0) return 'Afficher les 0 événements';
  if (count === 1) return "Afficher l'événement";
  return `Afficher les ${count} événements`;
}

function FilterChip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: {
    inactiveBackgroundColor: string;
    inactiveBorderColor: string;
    inactiveTextColor: string;
    activeBackgroundColor: string;
    activeBorderColor: string;
    activeTextColor: string;
  };
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && styles.chipActive,
        tone
          ? {
              backgroundColor: active ? tone.activeBackgroundColor : tone.inactiveBackgroundColor,
              borderColor: active ? tone.activeBorderColor : tone.inactiveBorderColor,
            }
          : null,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          tone ? { color: active ? tone.activeTextColor : tone.inactiveTextColor } : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
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
  onSortByChange,
  onSortOrderChange,
  hasLocation,
  whenPreset,
  onWhenPresetChange,
  selectedCategories,
  selectedSubcategories,
  onCategoriesChange,
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

  const showSortOrder = sortBy === 'date' || sortBy === 'endDate' || sortBy === 'created';
  const visibleSubcategories = useMemo(
    () => subcategories.filter((sub) => selectedCategories.includes(sub.category_id)),
    [selectedCategories, subcategories]
  );

  const resultsButtonLabel = useMemo(
    () => formatResultsButtonLabel(resultCount, isLoadingResults),
    [isLoadingResults, resultCount]
  );

  const summary = useMemo(() => {
    const parts: string[] = [];
    const metaLabel = META_FILTERS.find((item) => item.key === metaFilter)?.label;
    if (metaLabel && metaFilter !== 'all') parts.push(metaLabel);
    const dateLabel = DATE_PRESETS.find((item) => item.key === whenPreset)?.label;
    if (dateLabel) parts.push(dateLabel);
    if (selectedCategories.length === 1) {
      const label = categories.find((c) => c.id === selectedCategories[0])?.label;
      if (label) parts.push(label);
    } else if (selectedCategories.length > 1) {
      parts.push(`${selectedCategories.length} catégories`);
    }
    if (selectedSubcategories.length > 0) {
      parts.push(
        selectedSubcategories.length === 1
          ? '1 sous-catégorie'
          : `${selectedSubcategories.length} sous-catégories`
      );
    }
    if (mapMode === 'satellite') parts.push('Satellite');
    if (sortBy !== 'triage') parts.push(SORT_LABELS[sortBy]);
    return parts.length ? parts.join(' · ') : 'Aucun filtre actif';
  }, [
    categories,
    mapMode,
    metaFilter,
    selectedCategories,
    selectedSubcategories,
    sortBy,
    whenPreset,
  ]);

  const toggleCategory = (categoryId: string) => {
    const exists = selectedCategories.includes(categoryId);
    const nextCategories = exists
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];
    const nextSubcategories = selectedSubcategories.filter((subId) => {
      const sub = subcategories.find((item) => item.id === subId);
      return sub ? nextCategories.includes(sub.category_id) : false;
    });
    onCategoriesChange(nextCategories, nextSubcategories);
  };

  const toggleSubcategory = (subcategoryId: string) => {
    const exists = selectedSubcategories.includes(subcategoryId);
    const nextSubcategories = exists
      ? selectedSubcategories.filter((id) => id !== subcategoryId)
      : [...selectedSubcategories, subcategoryId];
    onCategoriesChange(selectedCategories, nextSubcategories);
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
              <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Fermer">
                <X size={20} color={colors.brand.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.summary}>{summary}</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionTitle}>Statut des événements</Text>
              <View style={styles.chipRow}>
                {META_FILTERS.map((item) => (
                  <FilterChip
                    key={item.key}
                    label={item.label}
                    active={metaFilter === item.key}
                    onPress={() => onMetaFilterChange(item.key)}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Quand</Text>
              <View style={styles.chipRow}>
                {DATE_PRESETS.map((item) => (
                  <FilterChip
                    key={item.key}
                    label={item.label}
                    active={whenPreset === item.key}
                    onPress={() => onWhenPresetChange(whenPreset === item.key ? undefined : item.key)}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Catégories</Text>
              <View style={styles.chipRow}>
                {categories.map((cat) => {
                  const categoryColor = getCategoryColor(cat.id);
                  const categoryTextColor = getCategoryTextColor(cat.id);
                  return (
                    <FilterChip
                      key={cat.id}
                      label={cat.label}
                      active={selectedCategories.includes(cat.id)}
                      tone={{
                        inactiveBackgroundColor: withAlpha(categoryColor, '1A'),
                        inactiveBorderColor: withAlpha(categoryColor, '33'),
                        inactiveTextColor: categoryColor,
                        activeBackgroundColor: categoryColor,
                        activeBorderColor: categoryColor,
                        activeTextColor: categoryTextColor,
                      }}
                      onPress={() => toggleCategory(cat.id)}
                    />
                  );
                })}
              </View>

              {selectedCategories.length > 0 && visibleSubcategories.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Sous-catégories</Text>
                  <View style={styles.chipRow}>
                    {visibleSubcategories.map((sub) => {
                      const categoryColor = getCategoryColor(sub.category_id);
                      const categoryTextColor = getCategoryTextColor(sub.category_id);
                      return (
                        <FilterChip
                          key={sub.id}
                          label={sub.label}
                          active={selectedSubcategories.includes(sub.id)}
                          tone={{
                            inactiveBackgroundColor: withAlpha(categoryColor, '1A'),
                            inactiveBorderColor: withAlpha(categoryColor, '33'),
                            inactiveTextColor: categoryColor,
                            activeBackgroundColor: categoryColor,
                            activeBorderColor: categoryColor,
                            activeTextColor: categoryTextColor,
                          }}
                          onPress={() => toggleSubcategory(sub.id)}
                        />
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionTitle}>Style de carte</Text>
              <View style={styles.chipRow}>
                {MAP_MODES.map((item) => (
                  <FilterChip
                    key={item.key}
                    label={item.label}
                    active={mapMode === item.key}
                    onPress={() => onMapModeChange(item.key)}
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Tri</Text>
              {!searchActive ? (
                <Text style={styles.sectionHint}>
                  {metaFilter !== 'all'
                    ? 'Les critères de recherche avancés sont actifs uniquement avec le statut « Tous ».'
                    : 'Pour lieu, dates précises ou texte libre, utilisez la barre de recherche.'}
                </Text>
              ) : null}
              <View style={styles.sortList}>
                {SORT_OPTIONS.map((option) => {
                  const disabled = option === 'distance' && !hasLocation;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.sortOption, disabled && styles.sortOptionDisabled]}
                      onPress={() => {
                        if (disabled) return;
                        onSortByChange(option);
                        if (
                          (option === 'date' || option === 'endDate' || option === 'created') &&
                          !sortOrder
                        ) {
                          onSortOrderChange(option === 'created' ? 'desc' : 'asc');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          sortBy === option && styles.sortOptionTextActive,
                          disabled && styles.sortOptionTextDisabled,
                        ]}
                      >
                        {SORT_LABELS[option]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {showSortOrder ? (
                <View style={styles.chipRow}>
                  {(['asc', 'desc'] as const).map((order) => (
                    <FilterChip
                      key={order}
                      label={order === 'asc' ? 'Ascendant' : 'Descendant'}
                      active={sortOrder === order}
                      onPress={() => onSortOrderChange(order)}
                    />
                  ))}
                </View>
              ) : null}
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

export function hasMapActiveFilters(
  metaFilter: EventMetaFilter,
  mapMode: 'standard' | 'satellite',
  sortBy: SortOption,
  whenPreset?: 'today' | 'tomorrow' | 'weekend',
  categoryIds?: string[],
  subcategoryIds?: string[]
) {
  if (metaFilter !== 'all') return true;
  if (whenPreset) return true;
  if (categoryIds && categoryIds.length > 0) return true;
  if (subcategoryIds && subcategoryIds.length > 0) return true;
  if (mapMode !== 'standard') return true;
  if (sortBy !== 'triage') return true;
  return false;
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
  title: {
    ...typography.h4,
    color: colors.brand.text,
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
  sectionTitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(43, 191, 227, 0.12)',
  },
  chipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.brand.secondary,
  },
  sortList: {
    gap: spacing.xs,
  },
  sortOption: {
    paddingVertical: spacing.sm,
  },
  sortOptionDisabled: {
    opacity: 0.45,
  },
  sortOptionText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  sortOptionTextDisabled: {
    color: colors.brand.textSecondary,
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
    color: '#0f1719',
    fontWeight: '700',
  },
});
