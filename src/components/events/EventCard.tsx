import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, MapPin, Calendar, Users, Share2 } from 'lucide-react-native';
import { Card } from '../ui';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import type { EventWithCreator } from '../../types/database';
import { EventImageCarousel } from './EventImageCarousel';

interface EventCardProps {
  event: EventWithCreator;
  onPress: () => void;
  onFavoritePress?: () => void;
  onSharePress?: () => void;
  showDistance?: boolean;
  distance?: number;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onPress,
  onFavoritePress,
  onSharePress,
  showDistance,
  distance,
}) => {
  const [isSwiping, setIsSwiping] = useState(false);
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const images = (() => {
    const urls = [
      event.cover_url,
      ...(event.media?.map((m) => m.url).filter((u) => !!u && u !== event.cover_url) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls)).slice(0, 4); // cover + 3 max
  })();

  return (
    <TouchableOpacity
      onPress={() => {
        if (isSwiping) return;
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Card padding="xs" elevation="md" style={styles.card}>
        {images.length > 0 && (
          <View style={styles.imageContainer}>
            <EventImageCarousel
              images={images}
              height={180}
              borderRadius={borderRadius.md}
              onSwipeStart={() => setIsSwiping(true)}
              onSwipeEnd={() => setIsSwiping(false)}
            />
            {(onFavoritePress || onSharePress) && (
              <View style={styles.overlayButtons}>
                {onSharePress && (
                  <TouchableOpacity style={styles.overlayButton} onPress={onSharePress} activeOpacity={0.7}>
                    <Share2 size={18} color={colors.neutral[50]} />
                  </TouchableOpacity>
                )}
                {onFavoritePress && (
                  <TouchableOpacity
                    style={styles.overlayButton}
                    onPress={onFavoritePress}
                    activeOpacity={0.7}
                  >
                    <Heart
                      size={18}
                      color={event.is_favorited ? colors.error[500] : colors.neutral[50]}
                      fill={event.is_favorited ? colors.error[500] : 'transparent'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {getCategoryLabel(event.category || '')}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.visibilityPill, event.visibility === 'public' ? styles.publicPill : styles.privatePill]}>
              <Text style={[styles.visibilityText, event.visibility === 'public' ? styles.publicText : styles.privateText]}>
                {event.visibility === 'public' ? 'Public' : 'Privé'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Calendar size={14} color={colors.neutral[600]} />
            <Text style={styles.metaText}>{formatDate(event.starts_at)}</Text>
          </View>

          <View style={styles.metaRow}>
            <MapPin size={14} color={colors.neutral[600]} />
            <Text style={styles.metaText} numberOfLines={1}>
              {event.city || event.address}
            </Text>
            {showDistance && distance !== undefined && (
              <Text style={styles.distanceText}> • {distance.toFixed(1)} km</Text>
            )}
          </View>

          {event.interests_count > 0 && (
            <View style={styles.metaRow}>
              <Users size={14} color={colors.neutral[600]} />
              <Text style={styles.metaText}>
                {event.interests_count} intéressé{event.interests_count > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {event.is_free && (
            <View style={styles.freeBadge}>
              <Text style={styles.freeText}>Gratuit</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: spacing.sm,
    borderRadius: borderRadius.full,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  categoryText: {
    color: colors.neutral[50],
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    flex: 1,
  },
  distanceText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  freeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  freeText: {
    color: colors.success[700],
    fontSize: 12,
    fontWeight: '600',
  },
  visibilityPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  visibilityText: {
    ...typography.caption,
    fontWeight: '700',
  },
  publicPill: {
    backgroundColor: colors.success[50],
  },
  privatePill: {
    backgroundColor: colors.warning[50],
  },
  publicText: {
    color: colors.success[700],
  },
  privateText: {
    color: colors.warning[700],
  },
});
