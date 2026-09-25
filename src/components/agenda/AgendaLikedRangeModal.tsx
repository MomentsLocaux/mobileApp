import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaEventRow } from '@/components/agenda/AgendaEventRow';
import { colors, spacing, typography } from '@/constants/theme';
import type { EventCardStats } from '@/services/event-card-stats.service';
import type { EventWithCreator } from '@/types/database';
import { isSameLocalDay } from '@/utils/agenda';

type Props = {
  visible: boolean;
  start: Date | null;
  end: Date | null;
  events: EventWithCreator[];
  statsByEventId: Record<string, EventCardStats>;
  likedIds: Set<string>;
  pendingIds: Set<string>;
  onClose: () => void;
  onOpen: (event: EventWithCreator) => void;
  onToggleHeart: (event: EventWithCreator) => void;
  onShare: (event: EventWithCreator) => void;
};

function rangeTitle(start: Date, end: Date): string {
  const full = { weekday: 'long' as const, day: 'numeric' as const, month: 'long' as const };
  if (isSameLocalDay(start, end)) return start.toLocaleDateString('fr-FR', full);
  const short = { day: 'numeric' as const, month: 'long' as const };
  return `${start.toLocaleDateString('fr-FR', short)} – ${end.toLocaleDateString('fr-FR', short)}`;
}

export function AgendaLikedRangeModal({
  visible,
  start,
  end,
  events,
  statsByEventId,
  likedIds,
  pendingIds,
  onClose,
  onOpen,
  onToggleHeart,
  onShare,
}: Props) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  const snapPoints = useMemo(() => ['46%', '90%'], []);
  const until = end ?? start;
  const single = start && until ? isSameLocalDay(start, until) : true;

  useEffect(() => {
    if (visible && start) {
      sheetRef.current?.present();
      presented.current = true;
      return;
    }
    if (presented.current) {
      presented.current = false;
      sheetRef.current?.dismiss();
    }
  }, [start, visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.28} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={() => {
        presented.current = false;
        onClose();
      }}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheet}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{start && until ? rangeTitle(start, until) : ''}</Text>
        <Text style={styles.subtitle}>
          {events.length === 0
            ? single ? 'Aucun moment aimé ce jour-là' : 'Aucun moment aimé sur cette période'
            : events.length === 1 ? '1 moment aimé' : `${events.length} moments aimés`}
        </Text>
      </View>
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {events.map((event) => (
          <AgendaEventRow
            key={event.id}
            event={event}
            stats={statsByEventId[event.id]}
            liked={likedIds.has(event.id)}
            pending={pendingIds.has(event.id)}
            onOpen={onOpen}
            onToggleHeart={onToggleHeart}
            onShare={onShare}
          />
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.brand.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 36,
    backgroundColor: '#B7CFBE',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  title: { ...typography.body, color: colors.brand.text, fontWeight: '700', textTransform: 'capitalize' },
  subtitle: { ...typography.caption, color: colors.brand.textSecondary },
  scroll: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
