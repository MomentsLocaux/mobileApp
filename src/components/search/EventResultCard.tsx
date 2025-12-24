import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MapPin, Calendar, Tag, Navigation2 } from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import { EventImageCarousel } from '../events/EventImageCarousel';

interface Props {
  event: EventWithCreator;
  distanceKm?: number;
  active?: boolean;
  onPress: () => void;
  onNavigate: () => void;
  onSelect?: () => void;
  onOpenCreator?: (creatorId: string) => void;
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

export const EventResultCard: React.FC<Props> = ({
  event,
  distanceKm,
  active = false,
  onPress,
  onNavigate,
  onSelect,
  onOpenCreator,
}) => {
  const [isSwiping, setIsSwiping] = useState(false);
  const categoryLabel = getCategoryLabel(event.category || '');
  const dateLabel = useMemo(() => formatDateRange(event.starts_at, event.ends_at), [event.starts_at, event.ends_at]);
  const tags = event.tags?.slice(0, 3) || [];
  const images = useMemo(() => {
    const urls = [
      event.cover_url,
      ...(event.media?.map((m) => m.url).filter((u) => !!u && u !== event.cover_url) as string[] | undefined || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(urls)).slice(0, 4);
  }, [event.cover_url, event.media]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, active && styles.cardActive]}
      onPress={() => {
        if (isSwiping) return;
        onSelect?.();
        onPress();
      }}
    >
      <View style={styles.imageWrapper}>
        <EventImageCarousel
          images={images}
          height={260}
          borderRadius={borderRadius.lg}
          onSwipeStart={() => setIsSwiping(true)}
          onSwipeEnd={() => setIsSwiping(false)}
        />
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>{categoryLabel}</Text>
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
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <View style={styles.row}>
            <MapPin size={16} color={colors.neutral[0]} />
            <Text style={styles.meta} numberOfLines={1}>
              {event.city || event.address || 'Lieu à venir'}
              {typeof distanceKm === 'number' ? ` • ${distanceKm.toFixed(1)} km` : ''}
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
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaButton} onPress={onNavigate}>
              <Navigation2 size={16} color={colors.neutral[900]} />
              <Text style={styles.ctaText}>Itinéraire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[200],
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
  },
  topBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  topBadgeText: {
    ...typography.caption,
    color: colors.neutral[0],
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
    justifyContent: 'flex-start',
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
});
