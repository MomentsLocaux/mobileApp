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
import { EventResultCard } from './EventResultCard';
import { EventCardStatsService } from '@/services/event-card-stats.service';
import { FloatingPressable } from '@/components/ui/FloatingPressable';

/** Peek band height so the card floats above the bottom sheet strip. */
const VIEWPORT_PEEK_OFFSET = VIEWPORT_PEEK_HEIGHT + spacing.md;

export const MAP_UNIT_CARD_HEIGHT = 248;

interface Props {
  event: EventWithCreator;
  visible: boolean;
  currentUserId?: string | null;
  isLiked?: boolean;
  onToggleLike?: (event: EventWithCreator) => void;
  onPress: () => void;
  onNavigate: () => void;
  onClose: () => void;
  bottomInset?: number;
}

export const MapEventUnitOverlay: React.FC<Props> = ({
  event,
  visible,
  currentUserId,
  isLiked,
  onToggleLike,
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
  }, [event.id, currentUserId]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * Motion.distance.cardEnterY },
      {
        scale:
          Motion.transform.cardInitialScale +
          progress.value * (1 - Motion.transform.cardInitialScale),
      },
    ],
  }));

  const closeEnterStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale:
          Motion.transform.buttonInitialScale +
          progress.value * (1 - Motion.transform.buttonInitialScale),
      },
    ],
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
            onToggleLike ? styles.closeButtonWithLike : null,
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

        <EventResultCard
          event={event}
          cardHeight={MAP_UNIT_CARD_HEIGHT}
          showCarousel={false}
          active
          noBottomMargin
          viewsCount={viewsCount}
          friendsGoingCount={friendsGoingCount}
          onPress={onPress}
          onNavigate={onNavigate}
          onToggleLike={onToggleLike}
          isLiked={isLiked}
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
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  cardShell: {
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 40,
  },
  closePressable: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  closeButtonWithLike: {
    right: spacing.md + 44 + spacing.xs,
  },
});
