import React, { forwardRef, useImperativeHandle, useMemo, useRef, useCallback } from 'react';
import { runOnJS } from 'react-native-reanimated';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector, NativeViewGestureHandler } from 'react-native-gesture-handler';
import type { EventWithCreator } from '../../types/database';
import type { EventMetaFilter } from '../../utils/filter-events';
import { colors, spacing, typography } from '../../constants/theme';
import { EventResultCard } from './EventResultCard';
import { MapResultCard, MAP_RESULT_CARD_STRIDE } from './MapResultCard';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';

export {
  VIEWPORT_PEEK_SNAP,
  VIEWPORT_MID_SNAP,
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

const META_SCOPE_LABELS: Record<EventMetaFilter, string> = {
  all: 'dans cette zone',
  live: 'en cours',
  upcoming: 'à venir',
  past: 'passés',
};

const SWIPE_THRESHOLD = 48;

export const SearchResultsBottomSheet = forwardRef<SearchResultsBottomSheetHandle, Props>(
  (
    {
      events,
      currentUserId,
      activeEventId,
      snapIndex,
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
    const carouselListRef = useRef<FlatList<EventWithCreator>>(null);
    const listRef = useRef<FlatList<EventWithCreator>>(null);
    const isCarouselScrollFromUserRef = useRef(false);
    const suppressCarouselSyncRef = useRef(false);
    const carouselPadding = spacing.lg;

    const maxIndex = mode === 'single' ? 1 : 2;
    const clampedIndex = Math.min(Math.max(0, snapIndex), maxIndex);
    const hasEvents = events.length > 0;
    const isPeek = mode !== 'single' && clampedIndex === 0;
    const isMid = mode !== 'single' && clampedIndex === 1;
    const isFull = mode === 'single' ? clampedIndex > 0 : clampedIndex >= 2;
    const showCarousel = isMid && hasEvents && !isLoading;
    const showFullList = isFull && hasEvents && !isLoading;
    const showEmpty = isFull && mode !== 'single' && !hasEvents && !isLoading;

    const [statsByEventId, setStatsByEventId] = React.useState<Record<string, EventCardStats>>({});

    const eventIds = React.useMemo(
      () => events.map((event) => event.id).filter(Boolean),
      [events]
    );
    const eventIdsKey = React.useMemo(() => eventIds.join(','), [eventIds]);

    const carouselSnapOffsets = useMemo(
      () => events.map((_, index) => carouselPadding + index * MAP_RESULT_CARD_STRIDE),
      [events, carouselPadding]
    );

    const requestSnapIndex = useCallback(
      (nextIndex: number) => {
        onSnapIndexChange(Math.min(Math.max(0, nextIndex), maxIndex));
      },
      [maxIndex, onSnapIndexChange]
    );

    const scrollToEvent = useCallback(
      (eventId: string) => {
        const targetIndex = events.findIndex((event) => event.id === eventId);
        if (targetIndex < 0) return;
        if (clampedIndex >= 2) {
          listRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.25 });
          return;
        }
        if (clampedIndex === 1) {
          isCarouselScrollFromUserRef.current = false;
          carouselListRef.current?.scrollToOffset({
            offset: carouselPadding + targetIndex * MAP_RESULT_CARD_STRIDE,
            animated: true,
          });
        }
      },
      [clampedIndex, events, carouselPadding]
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
      if (!activeEventId || !showCarousel || suppressCarouselSyncRef.current) return;
      scrollToEvent(activeEventId);
    }, [activeEventId, showCarousel, scrollToEvent]);

    useImperativeHandle(ref, () => ({
      open: (nextIndex = 1) => requestSnapIndex(nextIndex),
      close: () => requestSnapIndex(0),
      collapseToPeek: () => requestSnapIndex(0),
      scrollToEvent,
    }));

    const scopeLabel = META_SCOPE_LABELS[metaFilter];

    const peekTitle = useMemo(() => {
      if (isLoading) return 'Chargement...';
      if (!hasEvents) {
        return metaFilter === 'all'
          ? 'Aucun moment dans cette zone'
          : `Aucun moment ${scopeLabel}`;
      }
      return `Plus de ${peekCount} moment${peekCount > 1 ? 's' : ''} ${scopeLabel}`;
    }, [hasEvents, isLoading, metaFilter, peekCount, scopeLabel]);

    const handleCarouselMomentumEnd = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!isCarouselScrollFromUserRef.current) return;
        const offsetX = event.nativeEvent.contentOffset.x;
        const nextIndex = Math.round((offsetX - carouselPadding) / MAP_RESULT_CARD_STRIDE);
        const clamped = Math.max(0, Math.min(nextIndex, events.length - 1));
        const item = events[clamped];
        if (item && item.id !== activeEventId) {
          suppressCarouselSyncRef.current = true;
          onHighlightEvent(item, { focusMap: false });
          requestAnimationFrame(() => {
            suppressCarouselSyncRef.current = false;
          });
        }
        isCarouselScrollFromUserRef.current = false;
      },
      [activeEventId, carouselPadding, events, onHighlightEvent]
    );

    const handlePanEnd = useCallback(
      (translationY: number, currentIndex: number) => {
        if (translationY <= -SWIPE_THRESHOLD) {
          requestSnapIndex(currentIndex + 1);
          return;
        }
        if (translationY >= SWIPE_THRESHOLD) {
          requestSnapIndex(currentIndex - 1);
        }
      },
      [requestSnapIndex]
    );

    const handlePanGesture = useMemo(
      () =>
        Gesture.Pan()
          .activeOffsetY([-8, 8])
          .failOffsetX([-16, 16])
          .onEnd((event) => {
            runOnJS(handlePanEnd)(event.translationY, clampedIndex);
          }),
      [clampedIndex, handlePanEnd]
    );

    return (
      <View style={styles.container}>
        <GestureDetector gesture={handlePanGesture}>
          <View style={styles.handleArea}>
            <View style={styles.handleIndicator} />
          </View>
        </GestureDetector>

        <View style={isPeek ? styles.peekHeader : styles.header}>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.brand.secondary} size="small" />
              <Text style={styles.peekTitle}>{peekTitle}</Text>
            </View>
          ) : (
            <Text style={isPeek ? styles.peekTitle : styles.headerTitle}>{peekTitle}</Text>
          )}
          {!isPeek && events.length > 0 && isFull ? (
            <Text style={styles.headerSubtitle}>
              {events.length} résultat{events.length > 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>

        {showFullList && mode === 'single' && (
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

        {showCarousel && (
          <View style={styles.carouselSection}>
            <NativeViewGestureHandler disallowInterruption>
              <FlatList
                ref={carouselListRef}
                horizontal
                data={events}
                style={styles.carouselList}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                snapToOffsets={carouselSnapOffsets}
                decelerationRate="fast"
                disableIntervalMomentum
                contentContainerStyle={styles.carouselContent}
                onScrollBeginDrag={() => {
                  isCarouselScrollFromUserRef.current = true;
                }}
                onMomentumScrollEnd={handleCarouselMomentumEnd}
                renderItem={({ item }) => (
                  <MapResultCard
                    event={item}
                    active={item.id === activeEventId}
                    onPress={() => onHighlightEvent(item, { focusMap: true })}
                    onOpenDetails={() => onOpenDetails(item)}
                  />
                )}
              />
            </NativeViewGestureHandler>
            <TouchableOpacity
              style={styles.expandButton}
              activeOpacity={0.85}
              onPress={() => requestSnapIndex(2)}
            >
              <Text style={styles.expandText}>Afficher toute la liste</Text>
            </TouchableOpacity>
          </View>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>Zoomez ou déplacez la carte</Text>
          </View>
        )}

        {showFullList && mode !== 'single' && (
          <FlatList
            ref={listRef}
            data={events}
            style={styles.fullList}
            keyExtractor={(item: EventWithCreator) => item.id}
            contentContainerStyle={styles.listContent}
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
        )}
      </View>
    );
  }
);
SearchResultsBottomSheet.displayName = 'SearchResultsBottomSheet';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
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
    color: '#222222',
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
    color: '#222222',
  },
  headerSubtitle: {
    ...typography.caption,
    color: '#717171',
    marginTop: spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  carouselSection: {
    paddingBottom: spacing.sm,
  },
  carouselList: {
    flexGrow: 0,
  },
  carouselContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  expandButton: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  expandText: {
    ...typography.caption,
    color: '#222222',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  fullList: {
    flex: 1,
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
    color: '#717171',
    textAlign: 'center',
  },
});
