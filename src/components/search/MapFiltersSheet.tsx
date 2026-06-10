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
  Easing,
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

const SORT_LABELS: Record<SortOption, string> = {
  triage: 'Pertinence',
  date: 'Date début',
  endDate: 'Date fin',
  created: 'Date création',
  distance: 'Distance',
  popularity: 'Popularité',
};

const SORT_OPTIONS: SortOption[] = ['triage', 'date', 'endDate', 'created', 'distance', 'popularity'];

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
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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

  const showSortOrder = sortBy === 'date' || sortBy === 'endDate' || sortBy === 'created';

  const summary = useMemo(() => {
    const parts: string[] = [];
    const metaLabel = META_FILTERS.find((item) => item.key === metaFilter)?.label;
    if (metaLabel && metaFilter !== 'all') parts.push(metaLabel);
    if (mapMode === 'satellite') parts.push('Satellite');
    if (searchActive && sortBy !== 'triage') parts.push(SORT_LABELS[sortBy]);
    return parts.length ? parts.join(' · ') : 'Aucun filtre actif';
  }, [mapMode, metaFilter, searchActive, sortBy]);

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
        progress.value = withTiming(1, {
          duration: 340,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        });
        contentProgress.value = withDelay(
          120,
          withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) })
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

    progress.value = withTiming(0, {
      duration: 240,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    contentProgress.value = withTiming(0, { duration: 140 });
    closeTimeoutRef.current = setTimeout(() => {
      setOverlayMounted(false);
    }, 260);
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

              {searchActive ? (
                <>
                  <Text style={styles.sectionTitle}>Tri</Text>
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
                </>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.9}>
              <Text style={styles.doneButtonText}>Afficher les résultats</Text>
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
  searchActive: boolean,
  sortBy: SortOption
) {
  if (metaFilter !== 'all') return true;
  if (mapMode !== 'standard') return true;
  if (searchActive && sortBy !== 'triage') return true;
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
