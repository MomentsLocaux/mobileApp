import React, { forwardRef, useImperativeHandle, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  ActivityIndicator,
  FlatList,
  InteractionManager,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SlidersHorizontal } from 'lucide-react-native';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventWithCreator } from '../../types/database';
import type { EventMetaFilter } from '../../utils/filter-events';
import { SortControl } from '@/components/filters';
import { ALL_SORT_OPTIONS, SORT_OPTIONS } from '@/constants/filters';
import {
  formatViewportPeekHeading,
  formatViewportPeekSubtitle,
} from '../../utils/map-peek-label';
import {
  SHEET_SPRING_CONFIG,
  VIEWPORT_HALF_SNAP_INDEX,
  VIEWPORT_PEEK_HEIGHT,
  getSheetMaxSnapIndex,
  resolveSheetSnapTarget,
  type MapSheetMode,
} from '../../utils/map-sheet-layout';
import { colors, spacing, typography } from '../../constants/theme';
import { MapDiscoveryEventCard } from './MapDiscoveryEventCard';
import { MapDiscoveryHeader } from './MapDiscoveryHeader';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { selectMapSpotlight, mapEventDateHeading, estimateMapEventOffset } from '@/utils/map-discovery-presentation';
import { sharePublishedEvent } from '@/utils/event-share';
import type { MapHeartToggleResult } from '@/hooks/map/useMapSocialActions';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
import { MapResultsSkeleton } from './MapResultsSkeleton';
import { useAuth } from '@/hooks';
import { haptics } from '@/utils/haptics';
import { COVER_PREFETCH_AHEAD_LIMIT, bumpCoverPrefetchGeneration } from '@/utils/cover-prefetch-queue';
import { splitDiscoveryEnrichmentIds } from '@/utils/discovery-enrichment';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { sortEvents, getDistanceText } from '@/utils/sort-events';
import { useEventPreviewStore } from '@/store/eventPreviewStore';
import { useDiscoveryListWindow } from '@/hooks/useDiscoveryListWindow';
import { DiscoveryListWindowFooter } from '@/components/ui/DiscoveryListWindowFooter';

const SHEET_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 45,
  minimumViewTime: 80,
};

export {
  VIEWPORT_PEEK_SNAP,
  VIEWPORT_FULL_SNAP,
  VIEWPORT_PEEK_HEIGHT,
  VIEWPORT_PEEK_RATIO,
} from '../../utils/map-sheet-layout';

export type SearchResultsBottomSheetHandle = {
  open: (index?: number) => void;
  close: () => void;
  collapseToPeek: () => void;
  scrollToEvent: (eventId: string) => void;
};

interface Props {
  events: EventWithCreator[];
  currentUserId?: string | null;
  activeEventId?: string;
  snapIndex: number;
  sheetProgress: SharedValue<number>;
  sheetVisibleHeight: SharedValue<number>;
  minSheetHeight: SharedValue<number>;
  maxSheetHeight: SharedValue<number>;
  layoutHeight: SharedValue<number>;
  isSheetDragging?: boolean;
  onSheetDragStart: (snapIndex: number) => void;
  onSheetDragEnd: (targetIndex: number) => void;
  onSheetSnapSettled: (targetIndex: number) => void;
  onSheetDragCancel: () => void;
  onSelectEvent: (event: EventWithCreator) => void;
  onHighlightEvent: (event: EventWithCreator, options?: { focusMap?: boolean }) => void;
  onNavigate: (event: EventWithCreator) => void;
  onOpenDetails: (event: EventWithCreator) => void;
  onOpenCreator?: (creatorId: string) => void;
  onToggleHeart?: (event: EventWithCreator) => Promise<MapHeartToggleResult | null>;
  isHearted?: (id: string) => boolean;
  onSnapIndexChange: (index: number) => void;
  mode: 'single' | 'viewport';
  peekCount: number;
  metaFilter?: EventMetaFilter;
  isLoading?: boolean;
  sortBy?: SortOption;
  sortOrder?: SortOrder;
  onSortByChange?: (value: SortOption) => void;
  onSortChange?: (sortBy: SortOption, sortOrder?: SortOrder) => void;
  onSortOrderChange?: (order: SortOrder) => void;
  hasLocation?: boolean;
  sortCenter?: { latitude: number; longitude: number } | null;
  selectedCategories?: string[];
  hasViewportRefine?: boolean;
  onClearViewportFilters?: () => void;
  onOpenFilters?: () => void;
  bottomContentInset?: number;
}

const SHEET_SURFACE = colors.brand.page;
const SCROLL_EDGE_THRESHOLD = 2;
const LIST_COLLAPSE_PULL_THRESHOLD = 28;

function applySheetDragTranslation(
  translationY: number,
  nativeDragOrigin: SharedValue<number>,
  minSheetHeight: SharedValue<number>,
  maxSheetHeight: SharedValue<number>,
  sheetVisibleHeight: SharedValue<number>,
  sheetProgress: SharedValue<number>,
) {
  'worklet';
  const minHeight = minSheetHeight.value;
  const maxHeight = maxSheetHeight.value;
  const nextHeight = Math.min(
    maxHeight,
    Math.max(minHeight, nativeDragOrigin.value - translationY),
  );
  const range = Math.max(1, maxHeight - minHeight);
  sheetVisibleHeight.value = nextHeight;
  sheetProgress.value = Math.min(1, Math.max(0, (nextHeight - minHeight) / range));
}

function snapSheetAfterRelease(
  velocityY: number,
  mode: MapSheetMode,
  reduceMotion: boolean,
  layoutHeight: SharedValue<number>,
  sheetVisibleHeight: SharedValue<number>,
  sheetProgress: SharedValue<number>,
  onIndexCommitted: (index: number) => void,
  onSettled: (index: number) => void,
) {
  'worklet';
  const layout = layoutHeight.value;
  if (layout <= 0) return;
  const target = resolveSheetSnapTarget(
    sheetVisibleHeight.value,
    layout,
    mode,
    velocityY,
  );
  runOnJS(onIndexCommitted)(target.index);
  runOnJS(haptics.selection)();
  if (reduceMotion) {
    sheetVisibleHeight.value = target.height;
    sheetProgress.value = target.progress;
    runOnJS(onSettled)(target.index);
    return;
  }
  sheetVisibleHeight.value = withSpring(target.height, SHEET_SPRING_CONFIG);
  sheetProgress.value = withSpring(
    target.progress,
    SHEET_SPRING_CONFIG,
    (finished) => {
      'worklet';
      if (finished) runOnJS(onSettled)(target.index);
    },
  );
}

export const SearchResultsBottomSheet = forwardRef<SearchResultsBottomSheetHandle, Props>(
  (
    {
      events,
      currentUserId,
      activeEventId,
      snapIndex,
      sheetProgress,
      sheetVisibleHeight,
      minSheetHeight,
      maxSheetHeight,
      layoutHeight,
      isSheetDragging = false,
      onSheetDragStart,
      onSheetDragEnd,
      onSheetSnapSettled,
      onSheetDragCancel,
      onSelectEvent,
      onHighlightEvent,
      onNavigate,
      onOpenDetails,
      onOpenCreator,
      onToggleHeart,
      isHearted,
      onSnapIndexChange,
      mode,
      peekCount,
      metaFilter = 'all',
      isLoading = false,
      sortBy = 'triage',
      sortOrder,
      onSortByChange,
      onSortChange,
      onSortOrderChange,
      hasLocation = false,
      sortCenter = null,
      selectedCategories = [],
      hasViewportRefine: hasViewportRefineProp,
      onClearViewportFilters,
      onOpenFilters,
      bottomContentInset = spacing.xl,
    },
    ref
  ) => {
    const { profile } = useAuth();
    const listRef = useRef<FlatList<EventWithCreator>>(null);
    const listHeaderHeight = useRef(0);
    const resultsHeaderY = useRef(0);
    const scrollRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollAttempts = useRef(0);
    const scrollTarget = useRef<number | null>(null);
    const pendingHeartIds = useRef(new Set<string>());
    const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());
    const distanceFor = useCallback((event: EventWithCreator) => {
      const coordinates = typeof event.location === 'object' ? event.location?.coordinates : undefined;
      const latitude = coordinates?.[1] ?? event.latitude;
      const longitude = coordinates?.[0] ?? event.longitude;
      return typeof latitude === 'number' && typeof longitude === 'number'
        ? getDistanceText(latitude, longitude, sortCenter) : null;
    }, [sortCenter]);
    const shareEvent = useCallback(async (event: EventWithCreator) => {
      try {
        await sharePublishedEvent(event);
      } catch {
        Alert.alert('Erreur', 'Impossible d’ouvrir le partage pour le moment.');
      }
    }, []);
    const showAllEvents = useCallback(() => {
      listRef.current?.scrollToOffset({ offset: resultsHeaderY.current, animated: false });
    }, []);
    const prefetchSheetPage = useCallback((pageItems: EventWithCreator[]) => {
      pageItems.slice(0, COVER_PREFETCH_AHEAD_LIMIT).forEach((event) =>
        prefetchEventMedia(event, { priority: 'ahead' }),
      );
    }, []);
    const sortedEvents = useMemo(
      () => sortEvents(events, sortBy, sortCenter, sortOrder),
      [events, sortBy, sortCenter, sortOrder]
    );
    const {
      visibleItems,
      totalCount,
      loadingMore,
      orderKey,
      revealNextPage,
      revealThroughIndex,
      handleHighestViewedIndex,
    } = useDiscoveryListWindow(sortedEvents, { onPrefetchPage: prefetchSheetPage });
    const visibleCountRef = useRef(visibleItems.length);
    visibleCountRef.current = visibleItems.length;
    const handleHighestViewedIndexRef = useRef(handleHighestViewedIndex);
    handleHighestViewedIndexRef.current = handleHighestViewedIndex;
    const revealThroughIndexRef = useRef(revealThroughIndex);
    revealThroughIndexRef.current = revealThroughIndex;
    const onViewableItemsChanged = useRef(
      ({ viewableItems }: { viewableItems: { item?: EventWithCreator; index?: number | null }[] }) => {
        const visible = viewableItems
          .map((entry) => entry.item)
          .filter((event): event is EventWithCreator => Boolean(event?.id));
        if (!visible.length) return;
        useEventPreviewStore.getState().pinVisibleEvents(
          'map-sheet',
          visible.map((event) => event.id),
        );
        visible.forEach((event) => prefetchEventMedia(event, { priority: 'visible' }));
        const indexes = viewableItems
          .map((entry) => entry.index)
          .filter((index): index is number => index != null);
        if (indexes.length) {
          handleHighestViewedIndexRef.current(Math.max(...indexes));
        }
      },
    ).current;
    const dragActiveRef = useRef(false);
    const scrollYRef = useRef(0);
    const isExpandedRef = useRef(false);
    const scrollTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
      null
    );
    const maxIndex = getSheetMaxSnapIndex(mode);
    const clampedIndex = Math.min(Math.max(0, snapIndex), maxIndex);
    const nativeDragOrigin = useSharedValue(0);
    const listScrollY = useSharedValue(0);
    const listTouchStartY = useSharedValue(0);
    const listTouchStartX = useSharedValue(0);
    const snapIndexShared = useSharedValue(clampedIndex);
    const snapIndexRef = useRef(clampedIndex);
    snapIndexRef.current = clampedIndex;

    React.useEffect(() => {
      snapIndexShared.value = clampedIndex;
    }, [clampedIndex, snapIndexShared]);

    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    traceMapSheetPerf('SearchResultsBottomSheet render', {
      count: renderCountRef.current,
      isSheetDragging,
      snapIndex: clampedIndex,
    });

    const hasEvents = events.length > 0;
    const isInitialLoading = isLoading && !hasEvents;
    const isRefreshing = isLoading && hasEvents;
    const isSheetExpandable =
      hasEvents && (mode === 'single' || peekCount > 0);
    const isExpanded = clampedIndex >= 1;
    isExpandedRef.current = isExpanded;
    const reduceMotion = useReduceMotion();
    const showViewportList =
      mode !== 'single' && hasEvents;
    const showSingleDetail = mode === 'single' && isExpanded && hasEvents;
    const showEmpty = isExpanded && mode !== 'single' && !hasEvents && !isLoading;
    const showLoadingList = isExpanded && mode !== 'single' && isInitialLoading;
    const hasViewportRefine =
      hasViewportRefineProp ?? selectedCategories.length > 0;

    const [statsByEventId, setStatsByEventId] = React.useState<Record<string, EventCardStats>>({});
    const spotlightEvents = useMemo(
      () => selectMapSpotlight(
        events,
        sortCenter,
        Object.fromEntries(Object.entries(statsByEventId).map(([id, stats]) => [id, stats.likesCount])),
      ),
      [events, sortCenter, statsByEventId],
    );

    const { immediate: immediateStatIds, deferred: deferredStatIds } = React.useMemo(
      () =>
        splitDiscoveryEnrichmentIds({
          windowIds: visibleItems.map((event) => event.id).filter(Boolean),
          spotlightIds: spotlightEvents.map((event) => event.id).filter(Boolean),
        }),
      [visibleItems, spotlightEvents],
    );
    const immediateStatKey = immediateStatIds.join(',');
    const deferredStatKey = deferredStatIds.join(',');

    const requestSnapIndex = useCallback(
      (nextIndex: number) => {
        const clamped = Math.min(Math.max(0, nextIndex), maxIndex);
        if (clamped === snapIndexRef.current) return;
        onSnapIndexChange(clamped);
      },
      [maxIndex, onSnapIndexChange]
    );

    const scrollToEvent = useCallback(
      (eventId: string) => {
        const targetIndex = sortedEvents.findIndex((event) => event.id === eventId);
        if (targetIndex < 0 || !showViewportList) return;

        revealThroughIndexRef.current(targetIndex);
        if (scrollRetry.current) clearTimeout(scrollRetry.current);
        scrollAttempts.current = 0;
        scrollTarget.current = targetIndex;
        scrollTaskRef.current?.cancel?.();
        scrollTaskRef.current = InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            if (!listRef.current || targetIndex >= visibleCountRef.current) return;
            listRef.current.scrollToIndex({
              index: targetIndex,
              animated: !reduceMotion,
              viewPosition: 0.25,
            });
          });
        });
      },
      [sortedEvents, showViewportList, reduceMotion]
    );

    React.useEffect(
      () => () => {
        scrollTaskRef.current?.cancel?.();
        if (scrollRetry.current) clearTimeout(scrollRetry.current);
      },
      []
    );

    React.useEffect(() => {
      bumpCoverPrefetchGeneration();
      if (scrollRetry.current) clearTimeout(scrollRetry.current);
      scrollTarget.current = null;
      scrollYRef.current = 0;
      listScrollY.value = 0;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [orderKey, listScrollY]);

    React.useEffect(() => {
      setStatsByEventId({});
    }, [orderKey]);

    React.useEffect(() => {
      let cancelled = false;
      const immediateIds = immediateStatKey.split(',').filter(Boolean);
      const deferredIds = deferredStatKey.split(',').filter(Boolean);
      if (!immediateIds.length && !deferredIds.length) {
        setStatsByEventId({});
        return;
      }
      const load = async (ids: string[], merge: boolean) => {
        if (!ids.length) return;
        try {
          const stats = await EventCardStatsService.getStatsForEvents(ids, currentUserId);
          if (cancelled) return;
          setStatsByEventId((current) => (merge ? { ...current, ...stats } : stats));
        } catch {
          if (!cancelled && !merge) setStatsByEventId({});
        }
      };
      void load(immediateIds, true);
      const deferredTask = InteractionManager.runAfterInteractions(() => {
        void load(deferredIds, true);
      });
      return () => {
        cancelled = true;
        deferredTask.cancel?.();
      };
    }, [immediateStatKey, deferredStatKey, currentUserId]);

    const handleToggleHeart = useCallback(
      async (event: EventWithCreator) => {
        if (!onToggleHeart || pendingHeartIds.current.has(event.id)) return;
        pendingHeartIds.current.add(event.id);
        setPendingIds(new Set(pendingHeartIds.current));
        try {
          const result = await onToggleHeart(event);
          if (!result) return;
          const self = currentUserId
            ? {
                id: currentUserId,
                display_name: profile?.display_name || 'Moi',
                avatar_url: profile?.avatar_url || null,
                is_followed: false,
              }
            : null;
          setStatsByEventId((prev) => ({
            ...prev,
            [event.id]: EventCardStatsService.applyLikeToggle(
              event.id, result.beforeLiked, result.afterLiked, self, currentUserId,
              prev[event.id] ?? { viewsCount: 0, friendsGoingCount: 0, likesCount: event.likes_count ?? 0, likers: [] },
            ),
          }));
        } finally {
          pendingHeartIds.current.delete(event.id);
          setPendingIds(new Set(pendingHeartIds.current));
        }
      },
      [currentUserId, onToggleHeart, profile?.avatar_url, profile?.display_name],
    );

    const expandedChromeStyle = useAnimatedStyle(() => {
      const progress = reduceMotion
        ? sheetProgress.value > 0.04
          ? 1
          : 0
        : interpolate(
            sheetProgress.value,
            [0, 0.22],
            [0, 1],
            Extrapolation.CLAMP,
          );
      return {
        opacity: progress,
        transform: [{ translateY: (1 - progress) * Motion.distance.listEnterY }],
      };
    }, [reduceMotion, sheetProgress]);

    const peekChromeStyle = useAnimatedStyle(() => {
      const progress = reduceMotion
        ? sheetProgress.value > 0.04
          ? 0
          : 1
        : interpolate(
            sheetProgress.value,
            [0, 0.16],
            [1, 0],
            Extrapolation.CLAMP,
          );
      return {
        opacity: progress,
        transform: [{ translateY: (1 - progress) * -spacing.xs }],
      };
    }, [reduceMotion, sheetProgress]);

    React.useEffect(() => {
      if (!showViewportList || !activeEventId || !isExpanded) return;
      scrollToEvent(activeEventId);
    }, [activeEventId, isExpanded, showViewportList, scrollToEvent]);

    useImperativeHandle(ref, () => ({
      open: (nextIndex = 1) => {
        if (!isSheetExpandableRef.current) return;
        requestSnapIndex(nextIndex);
      },
      close: () => requestSnapIndex(0),
      collapseToPeek: () => requestSnapIndex(0),
      scrollToEvent,
    }));

    const showPeekLoading = isLoading && mode !== 'single';
    const peekHeading = useMemo(
      () => formatViewportPeekHeading(peekCount, metaFilter),
      [metaFilter, peekCount]
    );
    const peekSubtitle = useMemo(
      () => formatViewportPeekSubtitle(peekCount),
      [peekCount]
    );
    const peekAccessibilityLabel = useMemo(
      () =>
        showPeekLoading
          ? 'Recherche des événements dans cette zone'
          : `${peekHeading}. ${peekSubtitle}`,
      [peekHeading, peekSubtitle, showPeekLoading]
    );

    // Advanced search can still apply the otherwise API-only `created` sort:
    // list it so the active choice stays visible and reversible.
    const sortOptions = useMemo(
      () => (sortBy === 'created' ? ALL_SORT_OPTIONS : SORT_OPTIONS),
      [sortBy]
    );

    const beginSheetDrag = useCallback(() => {
      if (!isSheetExpandableRef.current || dragActiveRef.current) return;
      dragActiveRef.current = true;
      onSheetDragStart(snapIndexRef.current);
    }, [onSheetDragStart]);

    const finishSheetDrag = useCallback(
      (targetIndex: number) => {
        if (!dragActiveRef.current) return;
        dragActiveRef.current = false;
        onSheetDragEnd(targetIndex);
      },
      [onSheetDragEnd]
    );

    const settleSheetSnap = useCallback(
      (targetIndex: number) => {
        onSheetSnapSettled(targetIndex);
      },
      [onSheetSnapSettled]
    );

    const cancelSheetDrag = useCallback(() => {
      if (!dragActiveRef.current) return;
      dragActiveRef.current = false;
      onSheetDragCancel();
    }, [onSheetDragCancel]);

    React.useEffect(() => {
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState !== 'active') cancelSheetDrag();
      });
      return () => subscription.remove();
    }, [cancelSheetDrag]);

    const openFromPeekRef = useRef<() => void>(() => {});
    const isSheetExpandableRef = useRef(isSheetExpandable);
    isSheetExpandableRef.current = isSheetExpandable;

    const openFromPeek = useCallback(() => {
      if (!isSheetExpandableRef.current || snapIndexRef.current !== 0) return;
      requestSnapIndex(1);
    }, [requestSnapIndex]);
    openFromPeekRef.current = openFromPeek;

    React.useEffect(() => {
      if (isSheetDragging || isSheetExpandable || clampedIndex === 0) return;
      requestSnapIndex(0);
    }, [clampedIndex, isSheetDragging, isSheetExpandable, requestSnapIndex]);

    const sheetChromeGesture = useMemo(
      () =>
        Gesture.Pan()
          .enabled(isSheetExpandable)
          .activeOffsetY([-4, 4])
          .failOffsetX([-16, 16])
          .onStart(() => {
            'worklet';
            nativeDragOrigin.value = sheetVisibleHeight.value;
            runOnJS(beginSheetDrag)();
          })
          .onUpdate((gesture) => {
            'worklet';
            applySheetDragTranslation(
              gesture.translationY,
              nativeDragOrigin,
              minSheetHeight,
              maxSheetHeight,
              sheetVisibleHeight,
              sheetProgress,
            );
          })
          .onEnd((gesture) => {
            'worklet';
            snapSheetAfterRelease(
              gesture.velocityY / 1000,
              mode,
              reduceMotion,
              layoutHeight,
              sheetVisibleHeight,
              sheetProgress,
              finishSheetDrag,
              settleSheetSnap,
            );
          })
          .onFinalize((_gesture, success) => {
            'worklet';
            if (!success) runOnJS(cancelSheetDrag)();
          }),
      [
        beginSheetDrag,
        cancelSheetDrag,
        finishSheetDrag,
        isSheetExpandable,
        layoutHeight,
        maxSheetHeight,
        minSheetHeight,
        mode,
        nativeDragOrigin,
        reduceMotion,
        settleSheetSnap,
        sheetProgress,
        sheetVisibleHeight,
      ],
    );

    const nativeListGesture = useMemo(() => Gesture.Native(), []);

    const listSheetGesture = useMemo(
      () =>
        Gesture.Pan()
          .enabled(isSheetExpandable && isExpanded)
          .manualActivation(true)
          .failOffsetX([-24, 24])
          .simultaneousWithExternalGesture(nativeListGesture)
          .onTouchesDown((event) => {
            'worklet';
            void VIEWPORT_HALF_SNAP_INDEX;
            listTouchStartY.value = event.allTouches[0]?.absoluteY ?? 0;
            listTouchStartX.value = event.allTouches[0]?.absoluteX ?? 0;
          })
          .onTouchesMove((event, manager) => {
            'worklet';
            const y = event.allTouches[0]?.absoluteY ?? listTouchStartY.value;
            const dy = y - listTouchStartY.value;
            const dx = (event.allTouches[0]?.absoluteX ?? listTouchStartX.value) - listTouchStartX.value;
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
              manager.fail();
              return;
            }
            const atTop = listScrollY.value <= SCROLL_EDGE_THRESHOLD;
            const canCollapse = atTop && dy > 4 && snapIndexShared.value > 0;
            if (canCollapse) {
              manager.activate();
              return;
            }
            if (Math.abs(dy) > 10) {
              manager.fail();
            }
          })
          .onStart(() => {
            'worklet';
            nativeDragOrigin.value = sheetVisibleHeight.value;
            runOnJS(beginSheetDrag)();
          })
          .onUpdate((gesture) => {
            'worklet';
            applySheetDragTranslation(
              gesture.translationY,
              nativeDragOrigin,
              minSheetHeight,
              maxSheetHeight,
              sheetVisibleHeight,
              sheetProgress,
            );
          })
          .onEnd((gesture) => {
            'worklet';
            const atTop = listScrollY.value <= SCROLL_EDGE_THRESHOLD;
            let velocity = gesture.velocityY / 1000;
            if (
              atTop &&
              (gesture.translationY > LIST_COLLAPSE_PULL_THRESHOLD || velocity > 0.35)
            ) {
              velocity = Math.max(velocity, 0.6);
            }
            snapSheetAfterRelease(
              velocity,
              mode,
              reduceMotion,
              layoutHeight,
              sheetVisibleHeight,
              sheetProgress,
              finishSheetDrag,
              settleSheetSnap,
            );
          })
          .onFinalize((_gesture, success) => {
            'worklet';
            if (!success) runOnJS(cancelSheetDrag)();
          }),
      [
        beginSheetDrag,
        cancelSheetDrag,
        finishSheetDrag,
        isExpanded,
        isSheetExpandable,
        layoutHeight,
        listScrollY,
        listTouchStartY,
        listTouchStartX,
        maxSheetHeight,
        minSheetHeight,
        mode,
        nativeDragOrigin,
        nativeListGesture,
        reduceMotion,
        settleSheetSnap,
        sheetProgress,
        sheetVisibleHeight,
        snapIndexShared,
      ],
    );

    const renderListItem = useCallback(
      ({ item, index }: { item: EventWithCreator; index: number }) => {
        const heading = mapEventDateHeading(item, sortedEvents[index - 1], sortBy);
        return <View style={styles.rowWrap}>
          {heading ? <Text accessibilityRole="header" style={styles.dateHeading}>{heading}</Text> : null}
          <MapDiscoveryEventCard event={item} variant="feed" stats={statsByEventId[item.id]}
            liked={Boolean(isHearted?.(item.id))} pending={pendingIds.has(item.id)}
            active={item.id === activeEventId} distance={distanceFor(item)}
            onOpen={onOpenDetails} onHighlight={(event) => onHighlightEvent(event, { focusMap: false })}
            onToggleHeart={handleToggleHeart} onShare={shareEvent} />
        </View>;
      },
      [activeEventId, isHearted, onHighlightEvent, onOpenDetails, handleToggleHeart, statsByEventId, pendingIds, distanceFor, shareEvent, sortedEvents, sortBy]
    );

    return (
      <View style={styles.container}>
        <GestureDetector gesture={sheetChromeGesture}>
          <View style={styles.sheetChrome}>
          <Pressable style={[styles.handleArea, !isSheetExpandable && styles.handleAreaDisabled]}
            accessibilityRole="button" accessibilityLabel={isExpanded ? 'Replier la liste' : 'Afficher les événements'}
            accessibilityState={{ expanded: isExpanded, disabled: !isSheetExpandable }}
            disabled={!isSheetExpandable} hitSlop={12}
            onPress={() => isExpanded ? requestSnapIndex(0) : openFromPeekRef.current()}>
            {isSheetExpandable ? <View style={styles.handleIndicator} /> : null}
          </Pressable>

          <View style={styles.chromeContent}>
            <Animated.View
              pointerEvents={isExpanded ? 'none' : 'auto'}
              style={[styles.peekHeader, styles.chromeOverlay, peekChromeStyle]}
            >
              <Pressable
                style={styles.peekCopy}
                accessibilityRole={showPeekLoading ? 'progressbar' : 'button'}
                accessibilityLabel={peekAccessibilityLabel}
                accessibilityLiveRegion="polite"
                disabled={!isSheetExpandable}
                onPress={() => openFromPeekRef.current()}
              >
                {showPeekLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.brand.secondary}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                ) : (
                  <>
                    <Text style={styles.peekTitle} numberOfLines={1}>
                      {peekHeading}
                    </Text>
                    <Text style={styles.peekSubtitle} numberOfLines={1}>
                      {peekSubtitle}
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>

          {mode !== 'single' ? (
            <Animated.View
              pointerEvents={isExpanded ? 'auto' : 'none'}
              style={[styles.header, expandedChromeStyle]}
            >
              <View style={styles.headerRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerTitle}>On fait quoi dans le coin ?</Text>
                  {isRefreshing ? (
                    <Text
                      style={styles.refreshSubtitle}
                      accessibilityLiveRegion="polite"
                    >
                      Mise à jour de la zone…
                    </Text>
                  ) : Math.max(peekCount, totalCount) > 0 ? (
                    <Text style={styles.headerSubtitle}>
                      {Math.max(peekCount, totalCount)} résultat
                      {Math.max(peekCount, totalCount) > 1 ? 's' : ''}
                    </Text>
                  ) : null}
                </View>
                {onOpenFilters ? (
                  <TouchableOpacity
                    accessibilityLabel={
                      hasViewportRefine
                        ? 'Filtrer les événements, filtres actifs'
                        : 'Filtrer les événements'
                    }
                    accessibilityRole="button"
                    onPress={onOpenFilters}
                    style={styles.filterButton}
                  >
                    <SlidersHorizontal size={18} color={colors.brand.text} />
                    {hasViewportRefine ? <View style={styles.filterActiveDot} /> : null}
                  </TouchableOpacity>
                ) : null}
              </View>
              {onSortByChange ? (
                <SortControl
                  value={sortBy}
                  onChange={onSortByChange}
                  onSelectionChange={onSortChange}
                  sortOrder={sortOrder}
                  onSortOrderChange={onSortOrderChange}
                  hasLocation={hasLocation}
                  options={sortOptions}
                  mode="pill"
                  status={metaFilter}
                  style={styles.sortPill}
                  testID="map-sheet-sort"
                />
              ) : null}
            </Animated.View>
          ) : null}
            </View>
          </View>
        </GestureDetector>

        {showSingleDetail && (
          <View style={[styles.singleContainer, { paddingBottom: bottomContentInset }]}>
            <MapDiscoveryEventCard
              event={events[0]}
              variant="feed"
              stats={statsByEventId[events[0].id]}
              liked={Boolean(isHearted?.(events[0].id))}
              onOpen={onOpenDetails}
              onToggleHeart={handleToggleHeart}
              onShare={shareEvent}
              distance={distanceFor(events[0])}
            />
          </View>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>
              {hasViewportRefine
                ? 'Aucun événement pour ces filtres.'
                : 'Zoomez ou déplacez la carte'}
            </Text>
            {hasViewportRefine && onClearViewportFilters ? (
              <TouchableOpacity
                onPress={onClearViewportFilters}
                accessibilityRole="button"
                accessibilityLabel="Effacer les filtres"
                style={styles.emptyAction}
              >
                <Text style={styles.emptyActionText}>Effacer les filtres</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {showLoadingList ? <MapResultsSkeleton variant="list" /> : null}

        {showViewportList && (
          <GestureDetector gesture={listSheetGesture}>
            <Animated.View style={[styles.listSlot, expandedChromeStyle]}>
              <GestureDetector gesture={nativeListGesture}>
            <FlatList
              ref={listRef}
              data={visibleItems}
              extraData={`${orderKey}:${sortBy}:${sortOrder ?? ''}`}
              style={styles.fullList}
              keyExtractor={(item: EventWithCreator) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: bottomContentInset },
              ]}
              scrollEnabled={isExpanded && !isSheetDragging}
              bounces={isExpanded}
              alwaysBounceVertical={isExpanded}
              scrollEventThrottle={16}
              nestedScrollEnabled
              onScrollBeginDrag={() => {
                scrollTarget.current = null;
                if (scrollRetry.current) clearTimeout(scrollRetry.current);
              }}
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                scrollYRef.current = offsetY;
                listScrollY.value = offsetY;
              }}
              onScrollToIndexFailed={(info) => {
                if (scrollTarget.current !== info.index || scrollAttempts.current >= 24) return;
                scrollAttempts.current += 1;
                listRef.current?.scrollToOffset({
                  offset: estimateMapEventOffset(info.index, info.averageItemLength, listHeaderHeight.current),
                  animated: false,
                });
                if (scrollRetry.current) clearTimeout(scrollRetry.current);
                scrollRetry.current = setTimeout(() => {
                  if (scrollTarget.current === info.index && info.index < visibleCountRef.current) {
                    listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.25 });
                  }
                }, 180);
              }}
              ListHeaderComponent={
                <View onLayout={(event) => { listHeaderHeight.current = event.nativeEvent.layout.height; }}>
                  <MapDiscoveryHeader spotlight={spotlightEvents} stats={statsByEventId} pendingIds={pendingIds}
                    isHearted={isHearted} total={Math.max(peekCount, totalCount)} sortBy={sortBy} sortOrder={sortOrder}
                    hasLocation={hasLocation}
                    onOpen={onOpenDetails} onToggleHeart={handleToggleHeart} onShare={shareEvent}
                    onShowAll={showAllEvents}
                    onResultsLayout={(y) => { resultsHeaderY.current = y; }} distanceFor={distanceFor} />
                </View>
              }
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={false}
              viewabilityConfig={SHEET_VIEWABILITY_CONFIG}
              onViewableItemsChanged={onViewableItemsChanged}
              onEndReached={revealNextPage}
              onEndReachedThreshold={2}
              ListFooterComponent={<DiscoveryListWindowFooter loading={loadingMore} />}
              renderItem={renderListItem}
            />
              </GestureDetector>
            </Animated.View>
          </GestureDetector>
        )}
        {showViewportList && isExpanded ? (
          <Pressable onPress={() => requestSnapIndex(0)} accessibilityRole="button" accessibilityLabel="Revenir à la carte" style={[styles.mapButton, { bottom: Math.max(16, bottomContentInset - 48) + 16 }]}>
            <BrandIcon name="map" size={21} /><Text style={styles.mapButtonText}>Carte</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
);
SearchResultsBottomSheet.displayName = 'SearchResultsBottomSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SHEET_SURFACE,
  },
  sheetChrome: {
    flexGrow: 0,
    minHeight: VIEWPORT_PEEK_HEIGHT,
  },
  handleArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  handleAreaDisabled: {
    minHeight: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary[200],
  },
  chromeContent: {
    position: 'relative',
    minHeight: VIEWPORT_PEEK_HEIGHT,
  },
  chromeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  peekHeader: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  peekTitle: {
    ...typography.h4,
    color: colors.brand.text,
    flexShrink: 1,
    textAlign: 'center',
  },
  peekSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    paddingBottom: spacing.sm,
    minHeight: VIEWPORT_PEEK_HEIGHT,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerTextBlock: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.secondary,
    borderWidth: 1.5,
    borderColor: colors.brand.surface,
  },
  sortPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  headerTitle: {
    ...typography.h4,
    color: colors.brand.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.xs,
  },
  refreshSubtitle: {
    ...typography.caption,
    color: colors.brand.secondary,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  listSlot: {
    flex: 1,
    overflow: 'hidden',
  },
  fullList: {
    flex: 1,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  rowWrap: { paddingHorizontal: spacing.md },
  dateHeading: { ...typography.bodySmall, fontWeight: '700', color: colors.brand.text, marginTop: spacing.md },
  mapButton: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 18, borderRadius: 15, backgroundColor: colors.brand.page, borderWidth: 1, borderColor: colors.neutral[200], shadowColor: colors.brand.ink, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  mapButtonText: { ...typography.bodySmall, fontWeight: '700', color: colors.brand.text },
  singleContainer: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyActionText: {
    ...typography.body,
    color: colors.brand.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
