import React, { useEffect, useRef, useState } from 'react';
import { InteractionManager, View, StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { EventCard } from '@/components/events/EventCard';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { EventHeartButton } from '@/components/events/EventHeartButton';
import { unitCycleCardReveal } from '@/utils/map-unit-cycle';

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
  onNavigate,
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
    () => unitCycleCardReveal(progress.value) > 0.05,
    (next, previous) => {
      if (next !== previous) {
        runOnJS(setInteractive)(next);
      }
    },
  );

  const cardStyle = useAnimatedStyle(() => {
    const reveal = unitCycleCardReveal(progress.value);
    return {
      opacity: reveal,
      transform: [{ translateY: (1 - reveal) * Motion.distance.listEnterY }],
    };
  });

  const chromeEnterStyle = useAnimatedStyle(() => {
    const reveal = unitCycleCardReveal(progress.value);
    return {
      opacity: reveal,
      transform: [{ scale: 0.85 + reveal * 0.15 }],
    };
  });

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.wrapper, { bottom: bottomInset }, cardStyle]}
    >
      <View collapsable={false} style={styles.cardShell}>
        <Animated.View style={[styles.topActions, chromeEnterStyle]}>
          {onToggleHeart ? (
            <EventHeartButton
              active={Boolean(isHearted)}
              onPress={() => onToggleHeart(event)}
            />
          ) : null}
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

        <EventCard
          event={event}
          variant="map-preview"
          showCarousel={false}
          noBottomMargin
          viewsCount={cardStats?.viewsCount ?? 0}
          friendsGoingCount={cardStats?.friendsGoingCount ?? 0}
          likesCount={cardStats?.likesCount ?? event.likes_count ?? 0}
          likers={cardStats?.likers ?? []}
          onPress={onPress}
          onNavigate={onNavigate}
          isLiked={isHearted}
          isFavorite={isHearted}
        />
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
  },
  topActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
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
