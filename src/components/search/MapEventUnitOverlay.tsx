import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing } from '@/constants/theme';
import { Motion, createEnterTiming, createExitTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { VIEWPORT_PEEK_HEIGHT } from '@/utils/map-sheet-layout';
import { EventCard } from '@/components/events/EventCard';
import { EventCardStatsService } from '@/services/event-card-stats.service';
import { FloatingPressable } from '@/components/ui/FloatingPressable';

const VIEWPORT_PEEK_OFFSET = VIEWPORT_PEEK_HEIGHT + spacing.md;

interface Props {
  event: EventWithCreator;
  visible: boolean;
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
  visible,
  currentUserId,
  isHearted,
  onToggleHeart,
  onPress,
  onNavigate,
  onClose,
  bottomInset = spacing.md,
}) => {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [friendsGoingCount, setFriendsGoingCount] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = visible ? 1 : 0;
      return;
    }
    progress.value = withTiming(
      visible ? 1 : 0,
      visible
        ? createEnterTiming(Motion.duration.normal)
        : createExitTiming(Motion.duration.fast)
    );
  }, [progress, reduceMotion, visible]);

  useEffect(() => {
    let cancelled = false;
    EventCardStatsService.getStatsForEvents([event.id], currentUserId).then((stats) => {
      if (cancelled) return;
      const entry = stats[event.id];
      setViewsCount(entry?.viewsCount ?? 0);
      setFriendsGoingCount(entry?.friendsGoingCount ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, event.id]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * Motion.distance.listEnterY }],
  }));

  const closeEnterStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrapper, { bottom: bottomInset + VIEWPORT_PEEK_OFFSET }, cardStyle]}
    >
      <View style={styles.cardShell}>
        <Animated.View
          style={[
            styles.closeButton,
            onToggleHeart ? styles.closeButtonWithLike : null,
            closeEnterStyle,
          ]}
        >
          <FloatingPressable
            style={styles.closePressable}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            animateEntrance={false}
          >
            <X size={20} color={colors.brand.text} />
          </FloatingPressable>
        </Animated.View>

        <EventCard
          event={event}
          variant="map-preview"
          showCarousel={false}
          noBottomMargin
          viewsCount={viewsCount}
          friendsGoingCount={friendsGoingCount}
          onPress={onPress}
          onPrimaryAction={onPress}
          onNavigate={onNavigate}
          onHeartPress={onToggleHeart ? () => onToggleHeart(event) : undefined}
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
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 40,
  },
  closeButtonWithLike: {
    top: spacing.sm + 48,
  },
  closePressable: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18, 22, 28, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
