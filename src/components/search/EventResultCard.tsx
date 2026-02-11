import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { MapPin, Calendar, Tag, Navigation2, Heart } from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryColor, getCategoryLabel, getCategoryTextColor } from '../../constants/categories';
import { EventImageCarousel } from '../events/EventImageCarousel';
import { useLocationStore } from '@/store';
import { getDistanceText } from '@/utils/sort-events';

interface Props {
  event: EventWithCreator;
  distanceKm?: number;
  active?: boolean;
  showCarousel?: boolean;
  onPress: () => void;
  onNavigate: () => void;
  onSelect?: () => void;
  onOpenCreator?: (creatorId: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (event: EventWithCreator) => void;
}

function formatDateRange(starts_at: string, ends_at: string) {
  const start = new Date(starts_at);
  const end = new Date(ends_at);

  if (isNaN(start.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startLabel = start.toLocaleDateString('fr-FR', options);

  if (!isNaN(end.getTime()) && end.toDateString() !== start.toDateString()) {
    const endLabel = end.toLocaleDateString('fr-FR', options);
    return `${startLabel} - ${endLabel}`;
  }

  const timeLabel = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${startLabel} • ${timeLabel}`;
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
  active = false,
  showCarousel = true,
  onPress,
  onNavigate,
  onSelect,
  onOpenCreator,
  isFavorite,
  onToggleFavorite,
}) => {
  const [isSwiping, setIsSwiping] = useState(false);
  const { currentLocation } = useLocationStore();
  const categoryLabel = getCategoryLabel(event.category || '');
  const categoryColor = getCategoryColor(event.category || '');
  const categoryTextColor = getCategoryTextColor(event.category || '');
  const dateLabel = useMemo(() => formatDateRange(event.starts_at, event.ends_at), [event.starts_at, event.ends_at]);
  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);
  const distanceLabel = useMemo(() => {
    if (typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
      return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
    }
    const coords = extractCoords(event);
    if (!coords) return null;
    return getDistanceText(coords.lat, coords.lon, userLocation);
  }, [distanceKm, event, userLocation]);
  const tags = event.tags?.slice(0, 3) || [];
  const images = useMemo(() => {
    const urls = [
      event.cover_url,
      ...(event.media?.map((m) => m.url).filter((u) => !!u && u !== event.cover_url) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls)).slice(0, 4);
  }, [event.cover_url, event.media]);

  return (
    <Pressable
      style={[styles.card, active && styles.cardActive]}
      onPress={() => {
        if (isSwiping) return;
        onSelect?.();
        onPress();
      }}
      onStartShouldSetResponder={() => false}
      onMoveShouldSetResponder={() => false}
    >
      <View style={styles.imageWrapper}>
        {showCarousel ? (
          <EventImageCarousel
            images={images}
            height={260}
            borderRadius={borderRadius.lg}
            onSwipeStart={() => setIsSwiping(true)}
            onSwipeEnd={() => setIsSwiping(false)}
          />
        ) : images.length > 0 ? (
          <Image
            source={{ uri: images[0] }}
            style={[styles.staticImage, { borderRadius: borderRadius.lg }]}
          />
        ) : (
          <View style={[styles.staticImage, { borderRadius: borderRadius.lg }]} />
        )}
        <View style={[styles.topBadge, { backgroundColor: categoryColor }]}>
          <Text style={[styles.topBadgeText, { color: categoryTextColor }]}>{categoryLabel}</Text>
        </View>
        {event.creator?.id && (
          <TouchableOpacity
            style={styles.avatarWrapper}
            activeOpacity={0.85}
            onPress={() => onOpenCreator?.(event.creator!.id)}
          >
            {event.creator.avatar_url ? (
              <Image source={{ uri: event.creator.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {event.creator.display_name?.slice(0, 2)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <View style={styles.infoContent} pointerEvents="none">
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>
            <View style={styles.row}>
              <MapPin size={16} color={colors.neutral[0]} />
              <Text style={styles.meta} numberOfLines={1}>
                {event.city || event.address || 'Lieu à venir'}
              </Text>
            </View>
            <View style={styles.row}>
              <Calendar size={16} color={colors.neutral[0]} />
              <Text style={styles.meta} numberOfLines={1}>
                {dateLabel}
              </Text>
            </View>
            {tags.length > 0 && (
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Tag size={12} color={colors.neutral[0]} />
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.ctaRow} pointerEvents="auto">
            <TouchableOpacity style={styles.ctaButton} onPress={onNavigate}>
              <Navigation2 size={16} color={colors.neutral[900]} />
              <View style={styles.ctaTextRow}>
                <Text style={styles.ctaText}>Itinéraire</Text>
                {distanceLabel ? <Text style={styles.ctaDistance}>· {distanceLabel}</Text> : null}
              </View>
            </TouchableOpacity>
            {onToggleFavorite && (
              <TouchableOpacity
                style={styles.favoriteBtn}
                onPress={() => onToggleFavorite(event)}
                activeOpacity={0.8}
              >
                <Heart
                  size={18}
                  color={isFavorite ? colors.error[500] : colors.neutral[0]}
                  fill={isFavorite ? colors.error[500] : 'transparent'}
                />
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
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 0,
    marginHorizontal: 0,
  },
  cardActive: {
    borderColor: colors.primary[500],
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
  },
  staticImage: {
    width: '100%',
    height: 260,
    resizeMode: 'cover',
    backgroundColor: colors.neutral[200],
  },
  topBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  topBadgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  infoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: spacing.xs,
  },
  infoContent: {
    gap: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[0],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.neutral[0],
    flex: 1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#00000044',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    color: colors.neutral[0],
  },
  avatarWrapper: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.neutral[0],
    backgroundColor: colors.neutral[200],
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[400],
  },
  avatarInitials: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  ctaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  ctaText: {
    ...typography.bodySmall,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  ctaTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaDistance: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '700',
  },
  favoriteBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
