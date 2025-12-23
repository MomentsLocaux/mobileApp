import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, MapPin, Calendar, Tag } from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { Button } from '../ui';
import { getCategoryLabel } from '../../constants/categories';
import { EventImageCarousel } from '../events/EventImageCarousel';

interface Props {
  event: EventWithCreator;
  distanceKm?: number;
  active?: boolean;
  onPress: () => void;
  onNavigate: () => void;
  onSelect?: () => void;
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
}) => {
  const categoryLabel = getCategoryLabel(event.category || '');
  const dateLabel = useMemo(() => formatDateRange(event.starts_at, event.ends_at), [event.starts_at, event.ends_at]);
  const tags = event.tags?.slice(0, 3) || [];
  const images = [event.cover_url, ...(event.media?.map((m) => m.url).filter(Boolean) as string[])];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, active && styles.cardActive]}
      onPress={() => {
        onSelect?.();
        onPress();
      }}
    >
      <View style={styles.imageWrapper}>
        <EventImageCarousel images={images} height={180} borderRadius={0} />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{categoryLabel}</Text>
        </View>
        <View style={styles.favoriteIcon}>
          <Heart size={18} color={colors.neutral[0]} />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.row}>
          <MapPin size={16} color={colors.neutral[500]} />
          <Text style={styles.meta}>
            {event.city || event.address || 'Lieu à venir'}
            {typeof distanceKm === 'number' ? ` • ${distanceKm.toFixed(1)} km` : ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Calendar size={16} color={colors.neutral[500]} />
          <Text style={styles.meta}>{dateLabel}</Text>
        </View>

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Tag size={12} color={colors.primary[600]} />
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.description} numberOfLines={3}>
          {event.description || 'Aucune description'}
        </Text>

        <Button title="Y aller" onPress={onNavigate} fullWidth />
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
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  imageWrapper: {
    position: 'relative',
  },
  categoryBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  favoriteIcon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: '#00000055',
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.neutral[600],
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
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    color: colors.primary[700],
  },
  description: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    marginVertical: spacing.sm,
  },
});
