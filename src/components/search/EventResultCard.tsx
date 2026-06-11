import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryColor, getCategoryLabel, getCategoryTextColor } from '../../constants/categories';
import { EventImageCarousel } from '../events/EventImageCarousel';
import { useLocationStore } from '@/store';
import { getDistanceText } from '@/utils/sort-events';
import { getEventLiveWindow } from '@/utils/event-status';
import { EventCardContent } from '../events/EventCardContent';

export const EVENT_RESULT_CARD_HEIGHT = 420;
/** Compact height for cards inside the map bottom sheet list. */
export const EVENT_RESULT_LIST_CARD_HEIGHT = 280;
const COMPACT_THRESHOLD = 340;
const LIST_MEDIA_HEIGHT = 148;
const COMPACT_MEDIA_HEIGHT = 108;
const DEFAULT_EVENT_IMAGE = require('../../../assets/images/icon.png');

interface Props {
  event: EventWithCreator;
  distanceKm?: number;
  viewsCount?: number;
  friendsGoingCount?: number;
  active?: boolean;
  showCarousel?: boolean;
  cardHeight?: number;
  noBottomMargin?: boolean;
  onPress: () => void;
  onNavigate: () => void;
  onSelect?: () => void;
  onOpenCreator?: (creatorId: string) => void;
  isLiked?: boolean;
  onToggleLike?: (event: EventWithCreator) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (event: EventWithCreator) => void;
  listEntranceDelay?: number;
}

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
  return trimmed;
};

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

export const EventResultCard: React.FC<Props> = ({
  event,
  distanceKm,
  viewsCount,
  friendsGoingCount,
  active = false,
  showCarousel = true,
  cardHeight = EVENT_RESULT_CARD_HEIGHT,
  noBottomMargin = false,
  onPress,
  onNavigate,
  onSelect,
  onOpenCreator,
  isLiked,
  onToggleLike,
  listEntranceDelay = 0,
}) => {
  const reduceMotion = useReduceMotion();
  const [isSwiping, setIsSwiping] = useState(false);
  const activeProgress = useSharedValue(active ? 1 : 0);
  const entranceProgress = useSharedValue(reduceMotion || listEntranceDelay <= 0 ? 1 : 0);
  const pressScale = useSharedValue(1);
  const [now, setNow] = useState(() => new Date());
  const { currentLocation } = useLocationStore();

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

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
        { scale: activeScale * pressScale.value },
      ],
    };
  });

  const distanceLabel = useMemo(() => {
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
      return distanceKm < 1 ? null : `${distanceKm.toFixed(1)} km`;
    }
    const coords = extractCoords(event);
    if (!coords) return null;
    return getDistanceText(coords.lat, coords.lon, userLocation);
  }, [distanceKm, event, userLocation]);

  const images = useMemo(() => {
    const cover = normalizeImageUrl(event.cover_url);
    const urls = [
      cover,
      ...((event.media || []).map((m) => normalizeImageUrl(m.url))),
    ].filter((u): u is string => !!u);
    return Array.from(new Set(urls)).slice(0, 4);
  }, [event.cover_url, event.media]);

  const attendeesCount = Number.isFinite(friendsGoingCount as number) ? Number(friendsGoingCount) : 0;
  const viewCount = Number.isFinite(viewsCount as number) ? Number(viewsCount) : 0;
  const { isLive, liveUntilLabel } = useMemo(() => {
    const { isLive: liveNow, liveUntil } = getEventLiveWindow(event, now);
    return {
      isLive: liveNow,
      liveUntilLabel: liveUntil
        ? liveUntil.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : null,
    };
  }, [event.starts_at, event.ends_at, event.operating_hours, now]);
  const displayTags = useMemo(
    () =>
      (Array.isArray(event.tags) ? event.tags : [])
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim())
        .slice(0, 2),
    [event.tags],
  );
  const categoryLabel = getCategoryLabel(event.category || '').toUpperCase();
  const categoryColor = getCategoryColor(event.category || '');
  const categoryTextColor = getCategoryTextColor(event.category || '');
  const isCompact = cardHeight < COMPACT_THRESHOLD;
  const useStackedLayout = isCompact;
  const hasCarousel = showCarousel && images.length > 0;
  const mediaHeight = useStackedLayout
    ? hasCarousel
      ? LIST_MEDIA_HEIGHT
      : COMPACT_MEDIA_HEIGHT
    : cardHeight;
  const handleCardPress = () => {
    if (isSwiping) return;
    onSelect?.();
    onPress();
  };

  const badgesSection = (
    <View style={styles.topRow} pointerEvents="box-none">
      <View style={styles.badgesContainer}>
        {isLive && (
          <View style={[styles.badge, styles.badgeLive]}>
            <View style={styles.liveDot} />
            <Text style={styles.badgeTextLive}>EN DIRECT</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: categoryColor }]}>
          <Text style={[styles.badgeText, { color: categoryTextColor }]}>{categoryLabel}</Text>
        </View>
        {displayTags.map((tag) => (
          <View key={tag} style={[styles.badge, styles.tagBadge]}>
            <Text style={styles.tagText}>#{tag}</Text>
          </View>
        ))}
      </View>

      {onToggleLike && (
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={(e) => {
            e.stopPropagation();
            onToggleLike(event);
          }}
        >
          <Heart
            size={22}
            color={isLiked ? colors.brand.error : '#fff'}
            fill={isLiked ? colors.brand.error : 'rgba(0,0,0,0.3)'}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  const contentSection = (
    <EventCardContent
      event={event}
      tone={useStackedLayout ? 'surface' : 'overlay'}
      density={isCompact ? 'compact' : 'comfortable'}
      isLive={isLive}
      liveUntilLabel={liveUntilLabel}
      viewsCount={viewCount}
      distanceLabel={distanceLabel}
      friendsGoingCount={attendeesCount}
      onNavigate={onNavigate}
    />
  );

  const mediaSection =
    hasCarousel ? (
      <EventImageCarousel
        images={images}
        height={mediaHeight}
        borderRadius={useStackedLayout ? 0 : borderRadius.xl}
        onSwipeStart={() => setIsSwiping(true)}
        onSwipeEnd={() => setIsSwiping(false)}
      />
    ) : (
      <Image source={images[0] ? { uri: images[0] } : DEFAULT_EVENT_IMAGE} style={styles.image} />
    );

  return (
    <Animated.View
      style={[
        styles.card,
        { height: cardHeight },
        noBottomMargin && styles.cardNoBottomMargin,
        cardAnimatedStyle,
      ]}
    >
      {useStackedLayout ? (
        <View style={styles.stackedCard}>
          <View style={[styles.stackedMedia, { height: mediaHeight }]}>
            {mediaSection}
            {badgesSection}
          </View>
          <Pressable
            style={styles.stackedContent}
            onPressIn={() => {
              if (reduceMotion) return;
              pressScale.value = withTiming(Motion.transform.pressScale, {
                duration: Motion.duration.micro,
              });
            }}
            onPressOut={() => {
              pressScale.value = withSpring(1, Motion.spring.soft);
            }}
            onPress={handleCardPress}
          >
            {contentSection}
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.cardPressable}
          onPressIn={() => {
            if (reduceMotion) return;
            pressScale.value = withTiming(Motion.transform.pressScale, {
              duration: Motion.duration.micro,
            });
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, Motion.spring.soft);
          }}
          onPress={handleCardPress}
        >
          <View style={styles.imageContainer}>
            {mediaSection}

            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(15, 23, 25, 0.4)', 'rgba(15, 23, 25, 0.95)']}
              locations={[0, 0.5, 1]}
              style={styles.gradientOverlay}
            />

            {badgesSection}

            <View
              pointerEvents="box-none"
              style={[styles.contentContainer, isCompact && styles.contentContainerCompact]}
            >
              {contentSection}
            </View>
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.brand.surface,
    marginBottom: spacing.lg,
  },
  cardPressable: {
    flex: 1,
  },
  stackedCard: {
    flex: 1,
    overflow: 'hidden',
  },
  stackedMedia: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  stackedContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.brand.surface,
  },
  cardNoBottomMargin: {
    marginBottom: 0,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    maxWidth: '80%',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)', // For web
  },
  badgeLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextLive: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  tagText: {
    color: '#eee',
    fontSize: 11,
    fontWeight: '600',
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  contentContainerCompact: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
});
