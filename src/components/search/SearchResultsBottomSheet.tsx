import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  FlatList,
  InteractionManager,
  TouchableOpacity,
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
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventWithCreator } from '../../types/database';
import type { EventMetaFilter } from '../../utils/filter-events';
import { SortControl } from '@/components/filters';
import { ALL_SORT_OPTIONS, SORT_OPTIONS } from '@/constants/filters';
import { formatViewportPeekLabel } from '../../utils/map-peek-label';
import {
  SHEET_SPRING_CONFIG,
  VIEWPORT_HALF_SNAP_INDEX,
  VIEWPORT_PEEK_HEIGHT,
  getSheetMaxSnapIndex,
  resolveSheetSnapTarget,
  type MapSheetMode,
} from '../../utils/map-sheet-layout';
import { colors, spacing, typography } from '../../constants/theme';
import { EventResultCard, EVENT_RESULT_LIST_CARD_HEIGHT, EVENT_RESULT_SHEET_MEDIA_HEIGHT } from './EventResultCard';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
import { MapResultsSkeleton } from './MapResultsSkeleton';
import { haptics } from '@/utils/haptics';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { useEventPreviewStore } from '@/store/eventPreviewStore';
import { useDiscoveryListWindow } from '@/hooks/useDiscoveryListWindow';
import { DiscoveryListWindowFooter } from '@/components/ui';

const SHEET_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 45,
  minimumViewTime: 80,
};

export {
  VIEWPORT_PEEK_SNAP,
  VIEWPORT_HALF_SNAP,
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
  onToggleHeart?: (event: EventWithCreator) => void;
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
  selectedCategories?: string[];
  hasViewportRefine?: boolean;
  onClearViewportFilters?: () => void;
  bottomContentInset?: number;
}

const SHEET_SURFACE = colors.brand.page;
const SCROLL_EDGE_THRESHOLD = 2;
const LIST_COLLAPSE_PULL_THRESHOLD = 28;
const LIST_EXPAND_PULL_THRESHOLD = 28;
const LIST_ITEM_STRIDE = EVENT_RESULT_LIST_CARD_HEIGHT + spacing.md;

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
      selectedCategories = [],
      hasViewportRefine: hasViewportRefineProp,
      onClearViewportFilters,
      bottomContentInset = spacing.xl,
    },
    ref
  ) => {
    const listRef = useRef<FlatList<EventWithCreator>>(null);
    const prefetchSheetPage = useCallback((pageItems: EventWithCreator[]) => {
      pageItems.forEach((event) => prefetchEventMedia(event));
    }, []);
    const {
      visibleItems,
      totalCount,
      loadingMore,
      orderKey,
      revealNextPage,
      revealThroughIndex,
      handleHighestViewedIndex,
    } = useDiscoveryListWindow(events, { onPrefetchPage: prefetchSheetPage });
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
        visible.forEach((event) => prefetchEventMedia(event));
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
    const snapIndexShared = useSharedValue(clampedIndex);
    const snapIndexRef = useRef(clampedIndex);
    snapIndexRef.current = clampedIndex;

    useEffect(() => {
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

    const eventIds = React.useMemo(
      () => visibleItems.map((event) => event.id).filter(Boolean),
      [visibleItems]
    );
    const eventIdsKey = React.useMemo(() => eventIds.join(','), [eventIds]);

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
        const targetIndex = events.findIndex((event) => event.id === eventId);
        if (targetIndex < 0 || !showViewportList) return;

        revealThroughIndexRef.current(targetIndex);
        scrollTaskRef.current?.cancel?.();
        scrollTaskRef.current = InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            if (!listRef.current) return;
            listRef.current.scrollToIndex({
              index: targetIndex,
              animated: true,
              viewPosition: 0.25,
            });
          });
        });
      },
      [events, showViewportList]
    );

    React.useEffect(
      () => () => {
        scrollTaskRef.current?.cancel?.();
      },
      []
    );

    React.useEffect(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [orderKey]);

    React.useEffect(() => {
      let cancelled = false;
      if (!eventIds.length) {
        setStatsByEventId({});
        return;
      }
      const load = async () => {
        try {
          const stats = await EventCardStatsService.getStatsForEvents(eventIds, currentUserId);
          if (!cancelled) setStatsByEventId(stats);
        } catch {
          if (!cancelled) setStatsByEventId({});
        }
      };
      void load();
      return () => {
        cancelled = true;
      };
    }, [eventIds, eventIdsKey, currentUserId]);

    const handleToggleHeart = useCallback(
      async (event: EventWithCreator) => {
        const beforeLiked = Boolean(isHearted?.(event.id));
        await onToggleHeart?.(event);
        const self = currentUserId
          ? {
              id: currentUserId,
              display_name: 'Moi',
              avatar_url: null as string | null,
              is_followed: false,
            }
          : null;
        setStatsByEventId((prev) => ({
          ...prev,
          [event.id]: EventCardStatsService.applyLikeToggle(
            event.id,
            beforeLiked,
            !beforeLiked,
            self,
            currentUserId,
            prev[event.id],
          ),
        }));
      },
      [currentUserId, isHearted, onToggleHeart],
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

    const peekTitle = useMemo(
      () => formatViewportPeekLabel(peekCount, metaFilter, isInitialLoading),
      [isInitialLoading, metaFilter, peekCount]
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
            const minHeight = minSheetHeight.value;
            const maxHeight = maxSheetHeight.value;
            const nextHeight = Math.min(
              maxHeight,
              Math.max(minHeight, nativeDragOrigin.value - gesture.translationY),
            );
            const range = Math.max(1, maxHeight - minHeight);

            sheetVisibleHeight.value = nextHeight;
            sheetProgress.value = Math.min(
              1,
              Math.max(0, (nextHeight - minHeight) / range),
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
            listTouchStartY.value = event.allTouches[0]?.absoluteY ?? 0;
          })
          .onTouchesMove((event, manager) => {
            'worklet';
            const y = event.allTouches[0]?.absoluteY ?? listTouchStartY.value;
            const dy = y - listTouchStartY.value;
            const atTop = listScrollY.value <= SCROLL_EDGE_THRESHOLD;
            const canCollapse = atTop && dy > 4;
            const canExpand =
              atTop &&
              mode === 'viewport' &&
              snapIndexShared.value === VIEWPORT_HALF_SNAP_INDEX &&
              dy < -4;
            if (canCollapse || canExpand) {
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
            const minHeight = minSheetHeight.value;
            const maxHeight = maxSheetHeight.value;
            const nextHeight = Math.min(
              maxHeight,
              Math.max(minHeight, nativeDragOrigin.value - gesture.translationY),
            );
            const range = Math.max(1, maxHeight - minHeight);
            sheetVisibleHeight.value = nextHeight;
            sheetProgress.value = Math.min(
              1,
              Math.max(0, (nextHeight - minHeight) / range),
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
            } else if (
              mode === 'viewport' &&
              snapIndexShared.value === VIEWPORT_HALF_SNAP_INDEX &&
              atTop &&
              (gesture.translationY < -LIST_EXPAND_PULL_THRESHOLD || velocity < -0.35)
            ) {
              velocity = Math.min(velocity, -0.6);
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
      ({ item, index }: { item: EventWithCreator; index: number }) => (
        <EventResultCard
          event={item}
          mediaHeight={EVENT_RESULT_SHEET_MEDIA_HEIGHT}
          listEntranceDelay={isExpanded && index < 4 ? index * Motion.stagger.listItem : 0}
          viewsCount={statsByEventId[item.id]?.viewsCount ?? 0}
          friendsGoingCount={statsByEventId[item.id]?.friendsGoingCount ?? 0}
          likesCount={statsByEventId[item.id]?.likesCount ?? item.likes_count ?? 0}
          likers={statsByEventId[item.id]?.likers ?? []}
          active={item.id === activeEventId}
          onPress={() => onOpenDetails(item)}
          onSelect={() => {
            onHighlightEvent(item, { focusMap: false });
          }}
          onNavigate={() => onNavigate(item)}
          onOpenCreator={onOpenCreator}
          onToggleHeart={handleToggleHeart}
          isHearted={isHearted ? isHearted(item.id) : undefined}
        />
      ),
      [
        activeEventId,
        isExpanded,
        isHearted,
        onHighlightEvent,
        onNavigate,
        onOpenCreator,
        onOpenDetails,
        handleToggleHeart,
        statsByEventId,
      ]
    );

    return (
      <View style={styles.container}>
        <GestureDetector gesture={sheetChromeGesture}>
          <View style={styles.sheetChrome}>
          <View style={[styles.handleArea, !isSheetExpandable && styles.handleAreaDisabled]}>
            {isSheetExpandable ? <View style={styles.handleIndicator} /> : null}
          </View>

          <View style={styles.chromeContent}>
            <Animated.View
              pointerEvents="none"
              style={[styles.peekHeader, styles.chromeOverlay, peekChromeStyle]}
            >
              {isInitialLoading ? (
                <MapResultsSkeleton variant="peek" />
              ) : (
                <Text style={styles.peekTitle}>{peekTitle}</Text>
              )}
            </Animated.View>

          {mode !== 'single' ? (
            <Animated.View
              pointerEvents={isExpanded ? 'auto' : 'none'}
              style={[styles.header, expandedChromeStyle]}
            >
              <View style={styles.headerRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerTitle}>{peekTitle}</Text>
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
                {onSortByChange ? (
                  <SortControl
                    value={sortBy}
                    onChange={onSortByChange}
                    onSelectionChange={onSortChange}
                    sortOrder={sortOrder}
                    onSortOrderChange={onSortOrderChange}
                    hasLocation={hasLocation}
                    options={sortOptions}
                    mode="iconOnly"
                    status={metaFilter}
                  />
                ) : null}
              </View>
            </Animated.View>
          ) : null}
            </View>
          </View>
        </GestureDetector>

        {showSingleDetail && (
          <View style={[styles.singleContainer, { paddingBottom: bottomContentInset }]}>
            <EventResultCard
              event={events[0]}
              viewsCount={statsByEventId[events[0].id]?.viewsCount ?? 0}
              friendsGoingCount={statsByEventId[events[0].id]?.friendsGoingCount ?? 0}
              likesCount={statsByEventId[events[0].id]?.likesCount ?? events[0].likes_count ?? 0}
              likers={statsByEventId[events[0].id]?.likers ?? []}
              active
              onPress={() => onOpenDetails(events[0])}
              onSelect={() => onSelectEvent(events[0])}
              onNavigate={() => onNavigate(events[0])}
              onOpenCreator={onOpenCreator}
              onToggleHeart={handleToggleHeart}
              isHearted={isHearted ? isHearted(events[0].id) : undefined}
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
              extraData={orderKey}
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
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                scrollYRef.current = offsetY;
                listScrollY.value = offsetY;
              }}
              getItemLayout={(_, index) => ({
                length: LIST_ITEM_STRIDE,
                offset: LIST_ITEM_STRIDE * index,
                index,
              })}
              onScrollToIndexFailed={(info: { index: number; averageItemLength: number }) => {
                const fallbackOffset = info.averageItemLength
                  ? info.averageItemLength * info.index
                  : LIST_ITEM_STRIDE * info.index;
                listRef.current?.scrollToOffset({ offset: fallbackOffset, animated: true });
                requestAnimationFrame(() => {
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.25,
                  });
                });
              }}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews
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
    minHeight: VIEWPORT_PEEK_HEIGHT,
  },
  peekTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    paddingBottom: spacing.sm,
    minHeight: VIEWPORT_PEEK_HEIGHT,
    justifyContent: 'center',
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
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
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
