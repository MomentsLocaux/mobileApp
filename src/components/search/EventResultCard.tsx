import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, Dimensions } from 'react-native';
import { MapPin, Heart, Eye } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import { EventImageCarousel } from '../events/EventImageCarousel';
import { useLocationStore } from '@/store';
import { getDistanceText } from '@/utils/sort-events';
import { isEventLive } from '@/utils/event-status';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HEIGHT = 420;

interface Props {
  event: EventWithCreator;
  distanceKm?: number;
  viewsCount?: number;
  friendsGoingCount?: number;
  active?: boolean;
  showCarousel?: boolean;
  onPress: () => void;
  onNavigate: () => void;
  onSelect?: () => void;
  onOpenCreator?: (creatorId: string) => void;
  isLiked?: boolean;
  onToggleLike?: (event: EventWithCreator) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (event: EventWithCreator) => void;
}

function formatDateRange(starts_at: string) {
  const start = new Date(starts_at);
  if (isNaN(start.getTime())) return '';

  const timeLabel = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Format: "Samedi, 21:00"
  const dayName = start.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);

  return `${dayNameCap}, ${timeLabel}`;
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

export const EventResultCard: React.FC<Props> = ({
  event,
  distanceKm,
  viewsCount,
  friendsGoingCount,
  active = false,
  showCarousel = true,
  onPress,
  onNavigate,
  onSelect,
  onOpenCreator,
  isLiked,
  onToggleLike,
}) => {
  const [isSwiping, setIsSwiping] = useState(false);
  const { currentLocation } = useLocationStore();
  const dateLabel = useMemo(() => formatDateRange(event.starts_at), [event.starts_at]);

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const distanceLabel = useMemo(() => {
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
      return distanceKm < 1 ? null : `${distanceKm.toFixed(1)} km`;
    }
    const coords = extractCoords(event);
    if (!coords) return null;
    return getDistanceText(coords.lat, coords.lon, userLocation);
  }, [distanceKm, event, userLocation]);

  const images = useMemo(() => {
    const urls = [
      event.cover_url,
      ...(event.media?.map((m) => m.url).filter((u) => !!u && u !== event.cover_url) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls)).slice(0, 4);
  }, [event.cover_url, event.media]);

  const attendeesCount = Number.isFinite(friendsGoingCount as number) ? Number(friendsGoingCount) : 0;
  const viewCount = Number.isFinite(viewsCount as number) ? Number(viewsCount) : 0;
  const isLive = useMemo(() => isEventLive(event), [event.starts_at, event.ends_at]);
  const displayTags = useMemo(
    () =>
      (Array.isArray(event.tags) ? event.tags : [])
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim())
        .slice(0, 2),
    [event.tags],
  );
  const locationLabel = useMemo(
    () => event.venue_name || event.city || event.address || 'Lieu à venir',
    [event.venue_name, event.city, event.address],
  );
  const categoryLabel = getCategoryLabel(event.category || '').toUpperCase();

  return (
    <Pressable
      style={[styles.card, active && styles.cardActive]}
      onPress={() => {
        if (isSwiping) return;
        onSelect?.();
        onPress();
      }}
    >
      <View style={styles.imageContainer}>
        {showCarousel && images.length > 0 ? (
          <EventImageCarousel
            images={images}
            height={CARD_HEIGHT}
            borderRadius={borderRadius.xl}
            onSwipeStart={() => setIsSwiping(true)}
            onSwipeEnd={() => setIsSwiping(false)}
          />
        ) : (
          <Image
            source={{ uri: images[0] || 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?q=80&w=1000&auto=format&fit=crop' }}
            style={styles.image}
          />
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(15, 23, 25, 0.4)', 'rgba(15, 23, 25, 0.95)']}
          locations={[0, 0.5, 1]}
          style={styles.gradientOverlay}
        />

        {/* Top Badges */}
        <View style={styles.topRow}>
          <View style={styles.badgesContainer}>
            {isLive && (
              <View style={[styles.badge, styles.badgeLive]}>
                <Text style={styles.badgeText}>LIVE</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.badgeText}>{categoryLabel}</Text>
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

        {/* Content Overlay */}
        <View style={styles.contentContainer}>
          {/* Date & Location */}
          <Text style={styles.subtitle}>
            {dateLabel} • <Text style={styles.venueName}>{locationLabel}</Text>
          </Text>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          {/* Footer: Attendees & Stats */}
          <View style={styles.footer}>
            <View style={styles.attendeesContainer}>
              <View style={styles.avatarPile}>
                {Array.from({ length: Math.max(1, Math.min(attendeesCount, 3)) }).map((_, i) => (
                  <View key={i} style={[styles.attendeeAvatar, { transform: [{ translateX: -i * 10 }] }]}>
                    <View style={styles.attendeeDot} />
                  </View>
                ))}
                {attendeesCount > 3 && (
                  <View style={[styles.attendeeAvatar, styles.attendeeMore, { transform: [{ translateX: -30 }] }]}>
                    <Text style={styles.moreText}>+</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.attendeeText, { marginLeft: -20 }]}>
                {attendeesCount} ami{attendeesCount > 1 ? 's' : ''} y vont
              </Text>
            </View>

            <View style={styles.statsContainer}>
              <Eye size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.statsText}>{viewCount} vues</Text>
            </View>

            {distanceLabel && (
              <TouchableOpacity
                style={styles.locationBadge}
                onPress={(e) => {
                  e.stopPropagation();
                  onNavigate();
                }}
                activeOpacity={0.8}
              >
                <MapPin size={12} color={colors.brand.textSecondary} />
                <Text style={styles.statsText}>{distanceLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.brand.surface,
    marginBottom: spacing.lg,
  },
  cardActive: {
    transform: [{ scale: 0.98 }],
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
    backgroundColor: '#ff3b30', // Red
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
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.secondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  venueName: {
    color: colors.brand.text,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: spacing.md,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  attendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPile: {
    flexDirection: 'row',
    marginRight: 8,
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0f1719', // Match dark bg
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  attendeeDot: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  attendeeMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.secondary,
  },
  moreText: {
    fontSize: 8,
    color: '#000',
    fontWeight: 'bold',
  },
  attendeeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  statsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
});
