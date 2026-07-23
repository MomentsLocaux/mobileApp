import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { EventWithCreator } from '../../types/database';
import { useLocationStore } from '@/store';
import { getDistanceText } from '@/utils/sort-events';
import { EventCard } from '../events/EventCard';
import type { EventCardVariant } from '@/constants/event-card-variants';

/** Hauteur partagée bottom sheet (snap). Le feed Home omet cardHeight → hauteur intrinsèque. */
export const EVENT_RESULT_LIST_CARD_HEIGHT = 420;
/** @deprecated Alias — utiliser EVENT_RESULT_LIST_CARD_HEIGHT. */
export const EVENT_RESULT_CARD_HEIGHT = EVENT_RESULT_LIST_CARD_HEIGHT;

interface Props {
  event: EventWithCreator;
  /** Défaut `discovery` : même carte pour feed et bottom sheet. */
  variant?: EventCardVariant;
  distanceKm?: number;
  viewsCount?: number;
  friendsGoingCount?: number;
  active?: boolean;
  showCarousel?: boolean;
  /** When set, forces a minHeight (map sheet snap). Omit on feed lists for intrinsic height. */
  cardHeight?: number;
  noBottomMargin?: boolean;
  onPress: () => void;
  onNavigate: () => void;
  onSelect?: () => void;
  onOpenCreator?: (creatorId: string) => void;
  isHearted?: boolean;
  onToggleHeart?: (event: EventWithCreator) => void;
  listEntranceDelay?: number;
}

function extractCoords(event: EventWithCreator): { lat: number; lon: number } | null {
  if (Array.isArray((event as any)?.location?.coordinates)) {
    const [lon, lat] = (event as any).location.coordinates as [number, number];
    if (typeof lat === 'number' && typeof lon === 'number') {
      return { lat, lon };
    }
  }
  if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
    return { lat: event.latitude, lon: event.longitude };
  }
  return null;
}

const EventResultCardComponent: React.FC<Props> = ({
  event,
  variant = 'discovery',
  distanceKm,
  viewsCount,
  friendsGoingCount,
  active = false,
  showCarousel = true,
  cardHeight,
  noBottomMargin = false,
  onPress,
  onNavigate,
  onSelect,
  isHearted,
  onToggleHeart,
  listEntranceDelay = 0,
}) => {
  const reduceMotion = useReduceMotion();
  const activeProgress = useSharedValue(active ? 1 : 0);
  const entranceProgress = useSharedValue(reduceMotion || listEntranceDelay <= 0 ? 1 : 0);
  const { currentLocation } = useLocationStore();

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  useEffect(() => {
    activeProgress.value = reduceMotion
      ? active
        ? 1
        : 0
      : withSpring(active ? 1 : 0, Motion.spring.soft);
  }, [active, activeProgress, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || listEntranceDelay <= 0) {
      entranceProgress.value = 1;
      return;
    }
    entranceProgress.value = 0;
    const timer = setTimeout(() => {
      entranceProgress.value = withTiming(1, {
        duration: Motion.duration.fast,
        easing: Motion.easing.emphasized,
      });
    }, listEntranceDelay);
    return () => clearTimeout(timer);
  }, [entranceProgress, listEntranceDelay, reduceMotion]);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const activeScale = 1 - activeProgress.value * 0.02;
    return {
      opacity: entranceProgress.value,
      transform: [
        { translateY: (1 - entranceProgress.value) * Motion.distance.listEnterY },
        { scale: activeScale },
      ],
    };
  });

  const resolvedDistanceKm = useMemo(() => {
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) return distanceKm;
    const coords = extractCoords(event);
    if (!coords || !userLocation) return undefined;
    const label = getDistanceText(coords.lat, coords.lon, userLocation);
    if (!label) return undefined;
    const match = label.match(/([\d.]+)\s*km/i);
    return match ? Number(match[1]) : undefined;
  }, [distanceKm, event, userLocation]);

  const distanceLabel = useMemo(() => {
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
      return distanceKm < 1 ? null : `${distanceKm.toFixed(1)} km`;
    }
    const coords = extractCoords(event);
    if (!coords) return null;
    return getDistanceText(coords.lat, coords.lon, userLocation);
  }, [distanceKm, event, userLocation]);

  const handlePress = () => {
    onSelect?.();
    onPress();
  };

  const handleHeartPress = useMemo(
    () => (onToggleHeart ? () => onToggleHeart(event) : undefined),
    [event, onToggleHeart]
  );

  return (
    <Animated.View
      style={[styles.wrapper, cardHeight != null ? { minHeight: cardHeight } : null, cardAnimatedStyle]}
    >
      <EventCard
        event={event}
        variant={variant}
        showCarousel={showCarousel}
        noBottomMargin={noBottomMargin}
        onPress={handlePress}
        onPrimaryAction={onPress}
        onNavigate={onNavigate}
        onHeartPress={handleHeartPress}
        isFavorite={isHearted}
        isLiked={isHearted}
        distanceKm={resolvedDistanceKm}
        distanceLabel={distanceLabel}
        viewsCount={viewsCount}
        friendsGoingCount={friendsGoingCount}
        style={styles.cardFill}
      />
    </Animated.View>
  );
};

export const EventResultCard = React.memo(EventResultCardComponent);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  cardFill: {
    flex: 1,
  },
});
