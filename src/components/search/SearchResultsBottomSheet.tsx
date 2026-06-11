import React, { forwardRef, useImperativeHandle, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  PanResponder,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Motion, createEnterTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventWithCreator } from '../../types/database';
import type { EventMetaFilter } from '../../utils/filter-events';
import { TriageControl } from './TriageControl';
import { formatViewportPeekLabel } from '../../utils/map-peek-label';
import {
  VIEWPORT_PEEK_HEIGHT,
  VIEWPORT_HALF_SNAP_INDEX,
  VIEWPORT_FULL_SNAP_INDEX,
  getSheetMaxSnapIndex,
} from '../../utils/map-sheet-layout';
import { colors, spacing, typography } from '../../constants/theme';
import { EventResultCard, EVENT_RESULT_LIST_CARD_HEIGHT } from './EventResultCard';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';

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
  isSheetDragging?: boolean;
  onSheetDragStart: (snapIndex: number) => void;
  onSheetDragMove: (dy: number) => void;
  onSheetDragEnd: (dy: number, velocityY: number) => void;
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
  onSortOrderChange?: (order: SortOrder) => void;
  hasLocation?: boolean;
}

const SHEET_SURFACE = colors.brand.primary;
const SCROLL_EDGE_THRESHOLD = 2;
const LIST_COLLAPSE_PULL_THRESHOLD = 28;
const LIST_EXPAND_PULL_THRESHOLD = 28;

export const SearchResultsBottomSheet = forwardRef<SearchResultsBottomSheetHandle, Props>(
  (
    {
      events,
      currentUserId,
      activeEventId,
      snapIndex,
      isSheetDragging = false,
      onSheetDragStart,
      onSheetDragMove,
      onSheetDragEnd,
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
      onSortOrderChange,
      hasLocation = false,
    },
    ref
  ) => {
    const listRef = useRef<FlatList<EventWithCreator>>(null);
    const dragActiveRef = useRef(false);
    const scrollYRef = useRef(0);
    const isExpandedRef = useRef(false);

    const maxIndex = getSheetMaxSnapIndex(mode);
    const clampedIndex = Math.min(Math.max(0, snapIndex), maxIndex);
    const snapIndexRef = useRef(clampedIndex);
    snapIndexRef.current = clampedIndex;

    const hasEvents = events.length > 0;
    const isSheetExpandable =
      !isLoading && hasEvents && (mode === 'single' || peekCount > 0);
    const isPeek = clampedIndex === 0;
    const isExpanded = clampedIndex >= 1;
    isExpandedRef.current = isExpanded;
    const reduceMotion = useReduceMotion();
    const expandProgress = useSharedValue(isExpanded ? 1 : 0);
    const showViewportList =
      mode !== 'single' && hasEvents && !isLoading && (isExpanded || isSheetDragging);
    const showSingleDetail = mode === 'single' && isExpanded && hasEvents && !isLoading;
    const showEmpty = isExpanded && mode !== 'single' && !hasEvents && !isLoading;

    const [statsByEventId, setStatsByEventId] = React.useState<Record<string, EventCardStats>>({});

    const eventIds = React.useMemo(
      () => events.map((event) => event.id).filter(Boolean),
      [events]
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
        if (targetIndex < 0) return;
        listRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.25 });
      },
      [events]
    );

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

    React.useEffect(() => {
      expandProgress.value = reduceMotion
        ? isExpanded
          ? 1
          : 0
        : withTiming(isExpanded ? 1 : 0, createEnterTiming(Motion.duration.normal));
    }, [expandProgress, isExpanded, reduceMotion]);

    const expandedChromeStyle = useAnimatedStyle(() => ({
      opacity: expandProgress.value,
      transform: [{ translateY: (1 - expandProgress.value) * Motion.distance.listEnterY }],
    }));

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
      () => formatViewportPeekLabel(peekCount, metaFilter, isLoading),
      [isLoading, metaFilter, peekCount]
    );

    const beginSheetDrag = useCallback(() => {
      if (!isSheetExpandableRef.current || dragActiveRef.current) return;
      dragActiveRef.current = true;
      onSheetDragStart(snapIndexRef.current);
    }, [onSheetDragStart]);

    const finishSheetDrag = useCallback(
      (dy: number, velocityY: number) => {
        if (!dragActiveRef.current) return;
        onSheetDragEnd(dy, velocityY);
        dragActiveRef.current = false;
      },
      [onSheetDragEnd]
    );

    const openFromPeekRef = useRef<() => void>(() => {});
    const isSheetExpandableRef = useRef(isSheetExpandable);
    isSheetExpandableRef.current = isSheetExpandable;

    const isListAtScrollStart = useCallback(
      () => scrollYRef.current <= SCROLL_EDGE_THRESHOLD,
      []
    );

    const modeRef = useRef(mode);
    modeRef.current = mode;

    const shouldCollapseSheetFromList = useCallback(
      (dy: number) => {
        if (!isSheetExpandableRef.current || !isExpandedRef.current) return false;
        if (dy <= 4) return false;
        return isListAtScrollStart();
      },
      [isListAtScrollStart]
    );

    const shouldExpandSheetFromList = useCallback(
      (dy: number) => {
        if (!isSheetExpandableRef.current || !isExpandedRef.current) return false;
        if (modeRef.current !== 'viewport') return false;
        if (snapIndexRef.current !== VIEWPORT_HALF_SNAP_INDEX) return false;
        if (dy >= -4) return false;
        return isListAtScrollStart();
      },
      [isListAtScrollStart]
    );

    const openFromPeek = useCallback(() => {
      if (!isSheetExpandableRef.current || snapIndexRef.current !== 0) return;
      requestSnapIndex(1);
    }, [requestSnapIndex]);
    openFromPeekRef.current = openFromPeek;

    React.useEffect(() => {
      if (isSheetExpandable || clampedIndex === 0) return;
      requestSnapIndex(0);
    }, [clampedIndex, isSheetExpandable, requestSnapIndex]);

    const sheetChromePanResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => isSheetExpandableRef.current,
          onMoveShouldSetPanResponder: (_, gesture) =>
            isSheetExpandableRef.current &&
            Math.abs(gesture.dy) > 4 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.1,
          onPanResponderGrant: () => {
            dragActiveRef.current = false;
          },
          onPanResponderMove: (_, gesture) => {
            if (!isSheetExpandableRef.current) return;
            if (!dragActiveRef.current) {
              if (Math.abs(gesture.dy) <= 4) return;
              beginSheetDrag();
            }
            onSheetDragMove(gesture.dy);
          },
          onPanResponderRelease: (_, gesture) => {
            if (!isSheetExpandableRef.current) return;
            if (!dragActiveRef.current) {
              if (snapIndexRef.current === 0) {
                openFromPeekRef.current();
              }
              return;
            }
            finishSheetDrag(gesture.dy, gesture.vy);
          },
          onPanResponderTerminationRequest: () => false,
        }),
      [beginSheetDrag, finishSheetDrag, onSheetDragMove]
    );

    const listPanResponder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponderCapture: (_, gesture) =>
            Math.abs(gesture.dy) > 4 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.1 &&
            (shouldCollapseSheetFromList(gesture.dy) ||
              shouldExpandSheetFromList(gesture.dy)),
          onPanResponderGrant: () => {
            beginSheetDrag();
          },
          onPanResponderMove: (_, gesture) => {
            if (!dragActiveRef.current) return;
            onSheetDragMove(gesture.dy);
          },
          onPanResponderRelease: (_, gesture) => {
            if (!dragActiveRef.current) return;
            const collapseFromTop =
              isListAtScrollStart() &&
              (gesture.dy > LIST_COLLAPSE_PULL_THRESHOLD || gesture.vy > 0.35);
            const expandFromHalf =
              modeRef.current === 'viewport' &&
              snapIndexRef.current === VIEWPORT_HALF_SNAP_INDEX &&
              isListAtScrollStart() &&
              (gesture.dy < -LIST_EXPAND_PULL_THRESHOLD || gesture.vy < -0.35);

            let releaseVelocity = gesture.vy;
            if (collapseFromTop) {
              releaseVelocity = Math.max(gesture.vy, 0.6);
            } else if (expandFromHalf) {
              releaseVelocity = Math.min(gesture.vy, -0.6);
            }

            finishSheetDrag(gesture.dy, releaseVelocity);
          },
          onPanResponderTerminate: () => {
            dragActiveRef.current = false;
          },
          onPanResponderTerminationRequest: () => false,
        }),
      [
        beginSheetDrag,
        finishSheetDrag,
        isListAtScrollStart,
        onSheetDragMove,
        shouldCollapseSheetFromList,
        shouldExpandSheetFromList,
      ]
    );

    const sheetChromeHandlers = isSheetExpandable ? sheetChromePanResponder.panHandlers : {};
    const listPanHandlers =
      isSheetExpandable && isExpanded ? listPanResponder.panHandlers : {};

    return (
      <View style={styles.container}>
        <View style={styles.sheetChrome} {...sheetChromeHandlers}>
          <View style={[styles.handleArea, !isSheetExpandable && styles.handleAreaDisabled]}>
            {isSheetExpandable ? <View style={styles.handleIndicator} /> : null}
          </View>

          {isPeek ? (
            <View style={styles.peekHeader}>
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.brand.secondary} size="small" />
                  <Text style={styles.peekTitle}>{peekTitle}</Text>
                </View>
              ) : (
                <Text style={styles.peekTitle}>{peekTitle}</Text>
              )}
            </View>
          ) : null}

          {isExpanded && mode !== 'single' ? (
            <Animated.View style={[styles.header, expandedChromeStyle]}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerTitle}>{peekTitle}</Text>
                  {events.length > 0 ? (
                    <Text style={styles.headerSubtitle}>
                      {events.length} résultat{events.length > 1 ? 's' : ''}
                    </Text>
                  ) : null}
                </View>
                {onSortByChange ? (
                  <TriageControl
                    value={sortBy}
                    onChange={onSortByChange}
                    sortOrder={sortOrder}
                    onSortOrderChange={onSortOrderChange}
                    hasLocation={hasLocation}
                    showLabel={false}
                  />
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </View>

        {showSingleDetail && (
          <View style={styles.singleContainer}>
            <EventResultCard
              event={events[0]}
              viewsCount={statsByEventId[events[0].id]?.viewsCount ?? 0}
              friendsGoingCount={statsByEventId[events[0].id]?.friendsGoingCount ?? 0}
              active
              onPress={() => onOpenDetails(events[0])}
              onSelect={() => onSelectEvent(events[0])}
              onNavigate={() => onNavigate(events[0])}
              onOpenCreator={onOpenCreator}
              onToggleHeart={onToggleHeart}
              isHearted={isHearted ? isHearted(events[0].id) : undefined}
            />
          </View>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>Zoomez ou déplacez la carte</Text>
          </View>
        )}

        {showViewportList && (
          <Animated.View style={[styles.listSlot, expandedChromeStyle]} {...listPanHandlers}>
            <FlatList
              ref={listRef}
              data={events}
              style={styles.fullList}
              keyExtractor={(item: EventWithCreator) => item.id}
              contentContainerStyle={styles.listContent}
              scrollEnabled={isExpanded && !isSheetDragging}
              bounces={isExpanded}
              alwaysBounceVertical={isExpanded}
              scrollEventThrottle={16}
              nestedScrollEnabled
              onScroll={(event) => {
                scrollYRef.current = event.nativeEvent.contentOffset.y;
              }}
              onScrollToIndexFailed={(info: { index: number }) => {
                requestAnimationFrame(() => {
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.25,
                  });
                });
              }}
              renderItem={({ item, index }: { item: EventWithCreator; index: number }) => (
                <EventResultCard
                  event={item}
                  cardHeight={EVENT_RESULT_LIST_CARD_HEIGHT}
                  listEntranceDelay={
                    isExpanded && index < 4 ? index * Motion.stagger.listItem : 0
                  }
                  viewsCount={statsByEventId[item.id]?.viewsCount ?? 0}
                  friendsGoingCount={statsByEventId[item.id]?.friendsGoingCount ?? 0}
                  active={item.id === activeEventId}
                  onPress={() => onOpenDetails(item)}
                  onSelect={() => {
                    onHighlightEvent(item, { focusMap: false });
                  }}
                  onNavigate={() => onNavigate(item)}
                  onOpenCreator={onOpenCreator}
                  onToggleHeart={onToggleHeart}
                  isHearted={isHearted ? isHearted(item.id) : undefined}
                />
              )}
            />
          </Animated.View>
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
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingTop: spacing.sm,
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
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  peekHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  peekTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    minHeight: 44,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
});
