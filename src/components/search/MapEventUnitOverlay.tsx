import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Heart, X } from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing } from '@/constants/theme';
import { Motion, createEnterTiming, createExitTiming } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { VIEWPORT_PEEK_HEIGHT } from '@/utils/map-sheet-layout';
import { EventCard } from '@/components/events/EventCard';
import { EventCardStatsService } from '@/services/event-card-stats.service';
import { FloatingPressable } from '@/components/ui/FloatingPressable';
import { haptics } from '@/utils/haptics';

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
  const heartScale = useSharedValue(1);
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

  const chromeEnterStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleHeartPress = () => {
    if (!onToggleHeart) return;
    haptics.light();
    heartScale.value = withSequence(
      withTiming(1.18, { duration: 90 }),
      withTiming(1, { duration: 120 }),
    );
    onToggleHeart(event);
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrapper, { bottom: bottomInset + VIEWPORT_PEEK_OFFSET }, cardStyle]}
    >
      <View style={styles.cardShell}>
        <Animated.View style={[styles.closeButton, chromeEnterStyle]}>
          <FloatingPressable
            style={styles.chromePressable}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            animateEntrance={false}
          >
            <X size={20} color={colors.brand.text} />
          </FloatingPressable>
        </Animated.View>

        {onToggleHeart ? (
          <Animated.View style={[styles.heartButton, chromeEnterStyle]}>
            <FloatingPressable
              style={styles.chromePressable}
              onPress={handleHeartPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isHearted ? 'Retirer des favoris' : 'Aimer et enregistrer'}
              animateEntrance={false}
            >
              <Animated.View style={heartAnimatedStyle}>
                <Heart
                  size={20}
                  color={isHearted ? colors.brand.secondary : colors.brand.text}
                  fill={isHearted ? colors.brand.secondary : 'transparent'}
                />
              </Animated.View>
            </FloatingPressable>
          </Animated.View>
        ) : null}

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
  heartButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    zIndex: 40,
  },
  chromePressable: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
});
