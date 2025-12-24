import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { EventResultCard } from './EventResultCard';

export type SearchResultsBottomSheetHandle = {
  open: (index?: number) => void;
  close: () => void;
};

interface Props {
  events: EventWithCreator[];
  activeEventId?: string;
  onSelectEvent: (event: EventWithCreator) => void;
  onNavigate: (event: EventWithCreator) => void;
  onOpenDetails: (event: EventWithCreator) => void;
  onOpenCreator?: (creatorId: string) => void;
  onToggleFavorite?: (event: EventWithCreator) => void;
  isFavorite?: (id: string) => boolean;
  onIndexChange?: (index: number) => void;
  mode: 'single' | 'cluster' | 'viewport' | 'idle';
  peekCount: number;
  index?: number;
}

export const SearchResultsBottomSheet = forwardRef<SearchResultsBottomSheetHandle, Props>(
  (
    {
      events,
      activeEventId,
      onSelectEvent,
      onNavigate,
      onOpenDetails,
      onOpenCreator,
      onToggleFavorite,
      isFavorite,
      onIndexChange,
      mode,
      peekCount,
      index = 0,
    },
    ref
  ) => {
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['16%', '50%', '90%'], []);
    const hasEvents = events.length > 0;
    const showList = mode === 'single' || (index > 0 && mode !== 'idle');
    const showEmpty = index > 0 && mode !== 'single' && mode !== 'idle' && !hasEvents;

    useImperativeHandle(ref, () => ({
      open: (index = 1) => {
        sheetRef.current?.snapToIndex(index);
      },
      close: () => sheetRef.current?.close(),
    }));

    const headerTitle = useMemo(() => {
      if (mode === 'single' && hasEvents) {
        return events[0].title;
      }
      if (index === 0 || mode === 'idle') {
        return `${peekCount} moment${peekCount > 1 ? 's' : ''} dans cette zone`;
      }
      if (!events.length) return 'Aucun résultat';
      const active = events.find((e) => e.id === activeEventId);
      if (active) return active.title;
      return `${events.length} moment${events.length > 1 ? 's' : ''} trouvés`;
    }, [activeEventId, events, hasEvents, mode, peekCount]);

    return (
      <BottomSheet
        ref={sheetRef}
        index={index}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        onChange={(idx) => onIndexChange?.(idx)}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {events.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {events.length} résultat{events.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {showList && mode === 'single' && hasEvents && (
          <View style={styles.singleContainer}>
            <EventResultCard
              event={events[0]}
              active
              onPress={() => onOpenDetails(events[0])}
              onSelect={() => onSelectEvent(events[0])}
              onNavigate={() => onNavigate(events[0])}
              onOpenCreator={onOpenCreator}
              onToggleFavorite={onToggleFavorite}
              isFavorite={isFavorite ? isFavorite(events[0].id) : undefined}
            />
          </View>
        )}

        {!showList && mode !== 'idle' && (
          <TouchableOpacity
            style={styles.peekContainer}
            activeOpacity={0.8}
            onPress={() => {
              sheetRef.current?.snapToIndex(1);
            }}
          >
            <Text style={styles.peekText}>{peekCount} moment{peekCount > 1 ? 's' : ''} dans cette zone</Text>
            <Text style={styles.peekHint}>Balaye vers le haut pour voir la liste</Text>
          </TouchableOpacity>
        )}

        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySubtitle}>Zoomez ou déplacez la carte pour voir d&apos;autres moments</Text>
          </View>
        )}

        {showList && mode !== 'single' && hasEvents && (
          <BottomSheetFlatList
            data={events}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <EventResultCard
                event={item}
                active={item.id === activeEventId}
                onPress={() => onOpenDetails(item)}
                onSelect={() => onSelectEvent(item)}
                onNavigate={() => onNavigate(item)}
                onOpenCreator={onOpenCreator}
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

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.neutral[0],
  },
  handleIndicator: {
    backgroundColor: colors.neutral[300],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
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
    color: colors.neutral[700],
  },
  peekHint: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
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
    color: colors.neutral[800],
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
