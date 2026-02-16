import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography } from '../../constants/theme';
import { EventResultCard } from './EventResultCard';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';

export type SearchResultsBottomSheetHandle = {
  open: (index?: number) => void;
  close: () => void;
};

interface Props {
  events: EventWithCreator[];
  currentUserId?: string | null;
  activeEventId?: string;
  onSelectEvent: (event: EventWithCreator) => void;
  onNavigate: (event: EventWithCreator) => void;
  onOpenDetails: (event: EventWithCreator) => void;
  onOpenCreator?: (creatorId: string) => void;
  onToggleLike?: (event: EventWithCreator) => void;
  isLiked?: (id: string) => boolean;
  onToggleFavorite?: (event: EventWithCreator) => void;
  isFavorite?: (id: string) => boolean;
  onIndexChange?: (index: number) => void;
  mode: 'single' | 'viewport';
  peekCount: number;
  index?: number;
  isLoading?: boolean;
}

export const SearchResultsBottomSheet = forwardRef<SearchResultsBottomSheetHandle, Props>(
  (
    {
      events,
      currentUserId,
      activeEventId,
      onSelectEvent,
      onNavigate,
      onOpenDetails,
      onOpenCreator,
      onToggleLike,
      isLiked,
      onToggleFavorite,
      isFavorite,
      onIndexChange,
      mode,
      peekCount,
      index = 0,
      isLoading = false,
    },
    ref
  ) => {
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(
      () => (mode === 'single' ? ['16%', '47%'] : ['16%', '47%', '60%']),
      [mode]
    );
    const hasEvents = events.length > 0;
    const effectiveIndex = mode === 'single' ? Math.min(index, 1) : index;
    const maxIndex = snapPoints.length - 1;
    const clampedIndex = Math.min(Math.max(0, effectiveIndex), maxIndex);
    const showList = mode === 'single' || clampedIndex > 0;
    const showEmpty = clampedIndex > 0 && mode !== 'single' && !hasEvents && !isLoading;
    const [statsByEventId, setStatsByEventId] = React.useState<Record<string, EventCardStats>>({});

    const eventIds = React.useMemo(
      () => events.map((event) => event.id).filter(Boolean),
      [events],
    );
    const eventIdsKey = React.useMemo(() => eventIds.join(','), [eventIds]);

    React.useEffect(() => {
      let cancelled = false;
      if (!eventIds.length) {
        setStatsByEventId({});
        return;
      }

      const load = async () => {
        try {
          const stats = await EventCardStatsService.getStatsForEvents(eventIds, currentUserId);
          if (!cancelled) {
            setStatsByEventId(stats);
          }
        } catch {
          if (!cancelled) {
            setStatsByEventId({});
          }
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [eventIds, eventIdsKey, currentUserId]);

    useImperativeHandle(ref, () => ({
      open: (index = 1) => {
        const nextIndex = Math.min(Math.max(0, index), maxIndex);
        sheetRef.current?.snapToIndex(nextIndex);
      },
      close: () => sheetRef.current?.close(),
    }));

    const headerTitle = useMemo(() => {
      if (mode === 'single' && hasEvents) return events[0].title;
      if (!hasEvents) return 'Aucun résultat dans cette zone';
      if (clampedIndex === 0) {
        return `${peekCount} moment${peekCount > 1 ? 's' : ''} dans cette zone`;
      }
      const active = events.find((e) => e.id === activeEventId);
      if (active) return active.title;
      return `${events.length} moment${events.length > 1 ? 's' : ''} trouvés`;
    }, [activeEventId, events, hasEvents, mode, peekCount, clampedIndex]);

    return (
      <BottomSheet
        ref={sheetRef}
        index={clampedIndex}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableOverDrag={mode !== 'single'}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        onChange={(idx) => {
          const nextIndex = Math.min(Math.max(0, idx), maxIndex);
          if (nextIndex !== idx) {
            sheetRef.current?.snapToIndex(nextIndex);
          }
          onIndexChange?.(nextIndex);
        }}
      >
        <View style={styles.header}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.brand.secondary} />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.headerTitle}>{headerTitle}</Text>
              {events.length > 0 && (
                <Text style={styles.headerSubtitle}>
                  {events.length} résultat{events.length > 1 ? 's' : ''}
                </Text>
              )}
            </>
          )}
        </View>

        {showList && mode === 'single' && hasEvents && !isLoading && (
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

        {!showList && !isLoading && (
          <TouchableOpacity
            style={styles.peekContainer}
            activeOpacity={0.8}
            onPress={() => {
              sheetRef.current?.snapToIndex(1);
            }}
          >
            <Text style={styles.peekText}>Voir {peekCount} moment{peekCount > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySubtitle}>Zoomez ou déplacez la carte pour voir d&apos;autres moments</Text>
          </View>
        )}

        {showList && mode !== 'single' && hasEvents && !isLoading && (
          <BottomSheetFlatList<EventWithCreator>
            data={events}
            keyExtractor={(item: EventWithCreator) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }: { item: EventWithCreator }) => (
              <EventResultCard
                event={item}
                viewsCount={statsByEventId[item.id]?.viewsCount ?? 0}
                friendsGoingCount={statsByEventId[item.id]?.friendsGoingCount ?? 0}
                active={item.id === activeEventId}
                onPress={() => onOpenDetails(item)}
                onSelect={() => onSelectEvent(item)}
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
      </BottomSheet>
    );
  }
);
SearchResultsBottomSheet.displayName = 'SearchResultsBottomSheet';

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.brand.surface,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60, // Ensure header height is consistent
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },

  listContent: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  peekContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  peekText: {
    ...typography.body,
    color: colors.brand.text,
  },
  singleContainer: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
