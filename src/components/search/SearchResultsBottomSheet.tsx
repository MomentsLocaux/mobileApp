import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      onIndexChange,
      mode,
      peekCount,
      index = 0,
    },
    ref
  ) => {
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['10%', '45%', '90%'], []);
    const showList = index > 0 && mode !== 'idle';

    useImperativeHandle(ref, () => ({
      open: (index = 1) => {
        sheetRef.current?.snapToIndex(index);
      },
      close: () => sheetRef.current?.close(),
    }));

    const headerTitle = useMemo(() => {
      if (index === 0 || mode === 'idle') {
        return `${peekCount} moment${peekCount > 1 ? 's' : ''} dans cette zone`;
      }
      if (!events.length) return 'Aucun résultat';
      const active = events.find((e) => e.id === activeEventId);
      if (active) return active.title;
      return `${events.length} moment${events.length > 1 ? 's' : ''} trouvés`;
    }, [activeEventId, events, mode, peekCount]);

    return (
      <BottomSheet
        ref={sheetRef}
        index={events.length ? index : 0}
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

        {(!showList || mode === 'idle') && (
          <View style={styles.peekContainer}>
            <Text style={styles.peekText}>{peekCount} moment{peekCount > 1 ? 's' : ''} dans cette zone</Text>
          </View>
        )}

        {showList && (
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  peekContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  peekText: {
    ...typography.body,
    color: colors.neutral[700],
  },
});
