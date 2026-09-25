import React, { useEffect, useRef, useState } from 'react';
import { InteractionManager, View, StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing } from '@/constants/theme';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { MapDiscoveryEventCard } from '@/components/search/MapDiscoveryEventCard';
import { sharePublishedEvent } from '@/utils/event-share';

interface Props {
  event: EventWithCreator;
  progress: SharedValue<number>;
  currentUserId?: string | null;
  isHearted?: boolean;
  onToggleHeart?: (event: EventWithCreator) => void;
  onPress: () => void;
  onNavigate: () => void;
  onClose: () => void;
  bottomInset?: number;
}

export const MapEventUnitOverlay: React.FC<Props> = ({
  event,
  progress,
  currentUserId,
  isHearted,
  onToggleHeart,
  onPress,
  onNavigate: _onNavigate,
  onClose,
  bottomInset = spacing.md,
}) => {
  const [cardStats, setCardStats] = useState<EventCardStats | null>(null);
  const [interactive, setInteractive] = useState(false);
  const statsRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = statsRequestRef.current + 1;
    statsRequestRef.current = requestId;
    const task = InteractionManager.runAfterInteractions(() => {
      EventCardStatsService.getStatsForEvents([event.id], currentUserId).then((stats) => {
        if (cancelled || statsRequestRef.current !== requestId) return;
        setCardStats(stats[event.id] ?? null);
      });
    });
    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [currentUserId, event.id]);

  useAnimatedReaction(
    () => progress.value > 0.08,
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setInteractive)(next);
      }
    },
  );

  void _onNavigate;

  const cardStyle = useAnimatedStyle(() => {
    const reveal = Math.min(Math.max(progress.value, 0), 1);
    return {
      opacity: interpolate(reveal, [0, 0.35, 1], [0, 1, 1]),
      transform: [{ translateY: (1 - reveal) * 120 }],
    };
  });

  const chromeEnterStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(progress.value, 0), 1),
  }));

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.wrapper, { bottom: bottomInset }, cardStyle]}
    >
      <View collapsable={false} style={styles.cardShell}>
        <MapDiscoveryEventCard
          event={event}
          variant="feed"
          carousel
          framed
          stats={cardStats ?? undefined}
          liked={Boolean(isHearted)}
          onOpen={() => onPress()}
          onToggleHeart={(item) => onToggleHeart?.(item)}
          onShare={(item) => { void sharePublishedEvent(item); }}
          heartStyle={styles.cardHeart}
        />
        <Animated.View style={[styles.topActions, chromeEnterStyle]}>
          <FloatingPressable
            style={styles.chromePressable}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            animateEntrance={false}
          >
            <X size={17} color={colors.brand.text} />
          </FloatingPressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardShell: {
    position: 'relative',
    backgroundColor: colors.brand.page,
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardHeart: { top: 8, right: 46 },
  topActions: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chromePressable: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
});
