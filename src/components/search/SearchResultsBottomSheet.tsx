import React, { forwardRef, useImperativeHandle, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  PanResponder,
} from 'react-native';
import type { EventWithCreator } from '../../types/database';
import type { EventMetaFilter } from '../../utils/filter-events';
import { formatViewportPeekLabel } from '../../utils/map-peek-label';
import { VIEWPORT_PEEK_HEIGHT } from '../../utils/map-sheet-layout';
import { colors, spacing, typography } from '../../constants/theme';
import { EventResultCard } from './EventResultCard';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';

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
  isSheetDragging?: boolean;
  onSheetDragStart: (snapIndex: number) => void;
  onSheetDragMove: (dy: number) => void;
  onSheetDragEnd: (dy: number, velocityY: number) => void;
  onSelectEvent: (event: EventWithCreator) => void;
  onHighlightEvent: (event: EventWithCreator, options?: { focusMap?: boolean }) => void;
  onNavigate: (event: EventWithCreator) => void;
  onOpenDetails: (event: EventWithCreator) => void;
  onOpenCreator?: (creatorId: string) => void;
  onToggleLike?: (event: EventWithCreator) => void;
  isLiked?: (id: string) => boolean;
  onToggleFavorite?: (event: EventWithCreator) => void;
  isFavorite?: (id: string) => boolean;
  onSnapIndexChange: (index: number) => void;
  mode: 'single' | 'viewport';
  peekCount: number;
  metaFilter?: EventMetaFilter;
  isLoading?: boolean;
}

const SHEET_SURFACE = colors.brand.primary;

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
      onToggleLike,
      isLiked,
      onToggleFavorite,
      isFavorite,
      onSnapIndexChange,
      mode,
      peekCount,
      metaFilter = 'all',
      isLoading = false,
    },
    ref
  ) => {
    const listRef = useRef<FlatList<EventWithCreator>>(null);
    const dragActiveRef = useRef(false);

    const maxIndex = 1;
    const clampedIndex = Math.min(Math.max(0, snapIndex), maxIndex);
    const snapIndexRef = useRef(clampedIndex);
    snapIndexRef.current = clampedIndex;

    const hasEvents = events.length > 0;
    const isSheetExpandable =
      !isLoading && hasEvents && (mode === 'single' || peekCount > 0);
    const isPeek = clampedIndex === 0;
    const isExpanded = clampedIndex >= 1;
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

    const sheetChromeHandlers = isSheetExpandable ? sheetChromePanResponder.panHandlers : {};

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
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{peekTitle}</Text>
              {events.length > 0 ? (
                <Text style={styles.headerSubtitle}>
                  {events.length} résultat{events.length > 1 ? 's' : ''}
                </Text>
              ) : null}
            </View>
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
              onToggleLike={onToggleLike}
              isLiked={isLiked ? isLiked(events[0].id) : undefined}
              onToggleFavorite={onToggleFavorite}
              isFavorite={isFavorite ? isFavorite(events[0].id) : undefined}
            />
          </View>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>Zoomez ou déplacez la carte</Text>
          </View>
        )}

        {showViewportList && (
          <View style={styles.listSlot}>
            <FlatList
              ref={listRef}
              data={events}
              style={styles.fullList}
              keyExtractor={(item: EventWithCreator) => item.id}
              contentContainerStyle={styles.listContent}
              scrollEnabled={isExpanded && !isSheetDragging}
              bounces={isExpanded}
              scrollEventThrottle={16}
              nestedScrollEnabled
              onScrollToIndexFailed={(info: { index: number }) => {
                requestAnimationFrame(() => {
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.25,
                  });
                });
              }}
              renderItem={({ item }: { item: EventWithCreator }) => (
                <EventResultCard
                  event={item}
                  viewsCount={statsByEventId[item.id]?.viewsCount ?? 0}
                  friendsGoingCount={statsByEventId[item.id]?.friendsGoingCount ?? 0}
                  active={item.id === activeEventId}
                  onPress={() => onOpenDetails(item)}
                  onSelect={() => {
                    onHighlightEvent(item, { focusMap: false });
                    onSelectEvent(item);
                  }}
                  onNavigate={() => onNavigate(item)}
                  onOpenCreator={onOpenCreator}
                  onToggleLike={onToggleLike}
                  isLiked={isLiked ? isLiked(item.id) : undefined}
                  onToggleFavorite={onToggleFavorite}
                  isFavorite={isFavorite ? isFavorite(item.id) : undefined}
                />
              )}
            />
          </View>
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
