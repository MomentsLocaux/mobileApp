import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { EventWithCreator } from '../../types/database';
import type { EventMetaFilter } from '../../utils/filter-events';
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
  metaFilter?: EventMetaFilter;
  index?: number;
  isRefreshing?: boolean;
  bottomInset?: number;
}

const META_FILTER_LABELS: Record<EventMetaFilter, string> = {
  all: 'dans cette zone',
  live: 'en cours',
  upcoming: 'à venir',
  past: 'passés',
};

const NoBackdrop = (_props: BottomSheetBackdropProps) => null;

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
      metaFilter = 'all',
      index = 0,
      isRefreshing = false,
      bottomInset = 0,
    },
    ref
  ) => {
    const sheetRef = useRef<BottomSheetModal>(null);
    const isPresentedRef = useRef(false);
    const snapPoints = useMemo(
      () => (mode === 'single' ? ['22%', '50%'] : ['22%', '50%', '68%']),
      [mode]
    );
    const hasEvents = events.length > 0;
    const effectiveIndex = mode === 'single' ? Math.min(index, 1) : index;
    const maxIndex = snapPoints.length - 1;
    const clampedIndex = Math.min(Math.max(0, effectiveIndex), maxIndex);
    const showList = mode === 'single' || clampedIndex > 0;
    const showEmpty = clampedIndex > 0 && mode !== 'single' && !hasEvents && !isRefreshing;
    const scopeLabel = META_FILTER_LABELS[metaFilter];
    const [statsByEventId, setStatsByEventId] = React.useState<Record<string, EventCardStats>>({});

    const eventIds = React.useMemo(
      () => events.map((event) => event.id).filter(Boolean),
      [events],
    );
    const eventIdsKey = React.useMemo(() => eventIds.join(','), [eventIds]);

    const snapToSafeIndex = useCallback(
      (nextIndex: number) => {
        const safeIndex = Math.min(Math.max(0, nextIndex), maxIndex);
        sheetRef.current?.snapToIndex(safeIndex);
      },
      [maxIndex]
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
      open: (nextIndex = 1) => {
        if (!isPresentedRef.current) {
          sheetRef.current?.present();
          isPresentedRef.current = true;
        }
        snapToSafeIndex(nextIndex);
      },
      close: () => snapToSafeIndex(0),
    }));

    React.useEffect(() => {
      const timer = setTimeout(() => {
        if (!isPresentedRef.current) {
          sheetRef.current?.present();
          isPresentedRef.current = true;
        }
        snapToSafeIndex(clampedIndex);
      }, 0);

      return () => {
        clearTimeout(timer);
      };
    }, [clampedIndex, mode, snapPoints, snapToSafeIndex]);

    React.useEffect(() => {
      return () => {
        isPresentedRef.current = false;
        sheetRef.current?.dismiss();
      };
    }, []);

    const headerTitle = useMemo(() => {
      if (mode === 'single' && hasEvents) return events[0].title;
      if (peekCount > 0 && clampedIndex === 0) {
        return `${peekCount} moment${peekCount > 1 ? 's' : ''} ${scopeLabel}`;
      }
      if (!hasEvents) {
        return metaFilter === 'all'
          ? 'Aucun résultat dans cette zone'
          : `Aucun moment ${scopeLabel}`;
      }
      if (clampedIndex === 0) {
        return `${peekCount} moment${peekCount > 1 ? 's' : ''} ${scopeLabel}`;
      }
      const active = events.find((e) => e.id === activeEventId);
      if (active) return active.title;
      return `${events.length} moment${events.length > 1 ? 's' : ''} ${scopeLabel}`;
    }, [activeEventId, events, hasEvents, metaFilter, mode, peekCount, clampedIndex, scopeLabel]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        index={clampedIndex}
        bottomInset={bottomInset}
        enablePanDownToClose={false}
        enableDismissOnClose={false}
        enableOverDrag={mode !== 'single'}
        backdropComponent={NoBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        onChange={(idx) => {
          const nextIndex = Math.min(Math.max(0, idx), maxIndex);
          if (nextIndex !== idx) {
            snapToSafeIndex(nextIndex);
          }
          onIndexChange?.(nextIndex);
        }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {isRefreshing ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={colors.brand.secondary} />
              <Text style={styles.refreshText}>Mise à jour...</Text>
            </View>
          ) : events.length > 0 && clampedIndex > 0 ? (
            <Text style={styles.headerSubtitle}>
              {events.length} résultat{events.length > 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>

        {showList && mode === 'single' && hasEvents && (
          <View style={styles.singleContainer}>
            <EventResultCard
              event={events[0]}
              viewsCount={statsByEventId[events[0].id]?.viewsCount ?? 0}
              friendsGoingCount={statsByEventId[events[0].id]?.friendsGoingCount ?? 0}
              active
              onPress={() => onOpenDetails(events[0])}
              onNavigate={() => onNavigate(events[0])}
              onOpenCreator={onOpenCreator}
              onToggleLike={onToggleLike}
              isLiked={isLiked ? isLiked(events[0].id) : undefined}
              onToggleFavorite={onToggleFavorite}
              isFavorite={isFavorite ? isFavorite(events[0].id) : undefined}
            />
          </View>
        )}

        {!showList && peekCount > 0 && (
          <TouchableOpacity
            style={styles.peekContainer}
            activeOpacity={0.8}
            onPress={() => snapToSafeIndex(1)}
          >
            <Text style={styles.peekText}>
              Voir {peekCount} moment{peekCount > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {!showList && peekCount === 0 && !isRefreshing && (
          <View style={styles.peekEmptyContainer}>
            <Text style={styles.peekEmptyText}>
              {metaFilter === 'all'
                ? 'Aucun moment dans cette zone'
                : `Aucun moment ${scopeLabel}`}
            </Text>
          </View>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySubtitle}>
              Zoomez ou déplacez la carte pour voir d&apos;autres moments
            </Text>
          </View>
        )}

        {showList && mode !== 'single' && hasEvents && (
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
                onPress={() => onSelectEvent(item)}
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
      </BottomSheetModal>
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
    minHeight: 60,
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
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  refreshText: {
    ...typography.caption,
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
  peekEmptyContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  peekEmptyText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
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
