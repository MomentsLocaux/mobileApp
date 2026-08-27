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
import type { EventMetaFilter } from '@/utils/filter-events';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Motion, createEnterTiming, createExitTiming } from '@/constants/motion';
import { getCategoryColor, getCategoryTextColor } from '@/constants/categories';
import { filterColors } from '@/constants/filter-tokens';
import {
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
import { features } from '@/config/features';
import { useSettledViewportPeek } from '@/hooks/useSettledViewportPeek';
import { getMapWaitingMessage } from '@/utils/map-peek-label';

interface Props {
  visible: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<View | null>;
  metaFilter: EventMetaFilter;
  onMetaFilterChange: (filter: EventMetaFilter) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  searchActive: boolean;
  whenPreset?: DatePreset;
  onWhenPresetChange: (preset?: DatePreset) => void;
  selectedCategories: string[];
  selectedSubcategories: string[];
  onCategoriesChange: (categories: string[], subcategories: string[]) => void;
  onReset: () => void;
  resultCount: number;
  isLoadingResults?: boolean;
  waitingMessage?: string;
  filters: DiscoveryFilters;
}

function formatResultsButtonLabel(
  count: number,
  isWaiting = false,
  waitingMessage = getMapWaitingMessage()
): string {
  if (isWaiting) return waitingMessage;
  if (count <= 0) return 'Afficher les 0 événements';
  if (count === 1) return "Afficher l'événement";
  return `Afficher les ${count} événements`;
}

/** `mapMode` is a display preference and never counts as an active content filter. */
export function hasMapActiveFilters(filters: DiscoveryFilters): boolean {
  return activeFilterCount(filters) > 0;
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
  whenPreset,
  onWhenPresetChange,
  selectedCategories,
  selectedSubcategories,
  onCategoriesChange,
  onReset,
  resultCount,
  isLoadingResults = false,
  waitingMessage: waitingMessageOverride,
  filters,
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
  const {
    showWaiting: resultsWaiting,
    displayCount: settledResultCount,
    waitingMessage,
  } = useSettledViewportPeek(resultCount, isLoadingResults, waitingMessageOverride);

  const visibleSubcategories = useMemo(
    () =>
      features.subcategories
        ? subcategories.filter((sub) => selectedCategories.includes(sub.category_id))
        : [],
    [selectedCategories, subcategories]
  );

  const resultsButtonLabel = useMemo(
    () => formatResultsButtonLabel(settledResultCount, resultsWaiting, waitingMessage),
    [resultsWaiting, settledResultCount, waitingMessage]
  );

  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    categories.forEach((cat) => {
      labels[cat.id] = cat.label;
    });
    if (features.subcategories) {
      subcategories.forEach((sub) => {
        labels[sub.id] = sub.label;
      });
    }
    return labels;
  }, [categories, subcategories]);

  const summaryLabel = useMemo(
    () => summarize(filters, { categoryLabels, includeMapMode: true }),
    [categoryLabels, filters]
  );

  const canReset = useMemo(
    () => activeFilterCount(filters) > 0,
    [filters]
  );

  const searchHint = useMemo(() => {
    if (searchActive) {
      return 'Ces réglages affinent la recherche active (cadre lieu / dates / catégories). Le tri de la liste se règle dans le tiroir de résultats.';
    }
    return 'Pour lieu, dates précises ou texte libre, utilisez la barre de recherche. Statut et filtres se combinent.';
  }, [searchActive]);

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
              <Text style={styles.title}>
                {searchActive ? 'Affiner la sélection' : 'Filtres'}
              </Text>
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
            {searchActive ? (
              <Text style={styles.cadreHint}>
                Recherche active = cadre. Ici vous affinez sans remplacer le lieu.
              </Text>
            ) : null}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <FilterSection
                title={searchActive ? 'Vue · statut' : 'Statut des événements'}
                hint={
                  searchActive
                    ? 'Affiche un sous-ensemble des résultats de la recherche (ne change pas le cadre).'
                    : undefined
                }
              >
                <StatusFilterRow
                  value={metaFilter}
                  onChange={onMetaFilterChange}
                  scrollable={false}
                />
              </FilterSection>

              <FilterSection
                title="Quand"
                hint={
                  searchActive
                    ? 'Modifie les dates de la recherche active.'
                    : searchHint
                }
              >
                <WhenPresets
                  value={whenPreset ?? null}
                  onChange={(next) => onWhenPresetChange(next ?? undefined)}
                  status={metaFilter}
                  scrollable={false}
                />
              </FilterSection>

              <FilterSection
                title="Catégories"
                hint={
                  searchActive
                    ? 'Modifie les catégories de la recherche active.'
                    : undefined
                }
              >
                <FilterChipRow
                  mode="multi"
                  options={categoryOptions}
                  values={selectedCategories}
                  onChange={handleCategoriesChange}
                  scrollable={false}
                  accessibilityLabel="Catégories"
                />
              </FilterSection>

              {features.subcategories && subcategoryOptions.length > 0 ? (
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
    backgroundColor: colors.brand.page,
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
    marginBottom: spacing.sm,
  },
  cadreHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
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
