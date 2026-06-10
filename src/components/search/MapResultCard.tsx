import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { MapPin } from 'lucide-react-native';
import type { EventWithCreator } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { getCategoryLabel } from '../../constants/categories';
import { isEventLive } from '../../utils/event-status';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const MAP_RESULT_CARD_WIDTH = Math.min(300, SCREEN_WIDTH * 0.78);
export const MAP_RESULT_CARD_STRIDE = MAP_RESULT_CARD_WIDTH + spacing.sm;
const CARD_HEIGHT = 108;
const DEFAULT_EVENT_IMAGE = require('../../../assets/images/icon.png');

interface Props {
  event: EventWithCreator;
  active?: boolean;
  onPress: () => void;
  onOpenDetails?: () => void;
}

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
  return trimmed;
};

function formatShortDate(starts_at: string) {
  const start = new Date(starts_at);
  if (Number.isNaN(start.getTime())) return '';
  const dayName = start.toLocaleDateString('fr-FR', { weekday: 'short' });
  const timeLabel = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${dayName.charAt(0).toUpperCase()}${dayName.slice(1)} · ${timeLabel}`;
}

export const MapResultCard: React.FC<Props> = ({ event, active = false, onPress, onOpenDetails }) => {
  const imageUri = useMemo(() => normalizeImageUrl(event.cover_url), [event.cover_url]);
  const isLive = isEventLive(event);
  const categoryLabel = getCategoryLabel(event.category || '');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      <Image source={imageUri ? { uri: imageUri } : DEFAULT_EVENT_IMAGE} style={styles.image} />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          {onOpenDetails ? (
            <Pressable onPress={onOpenDetails} hitSlop={8}>
              <Text style={styles.detailsLink}>Détails</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.date} numberOfLines={1}>
          {formatShortDate(event.starts_at)}
        </Text>
        <View style={styles.metaRow}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>EN DIRECT</Text>
            </View>
          ) : null}
          <Text style={styles.category} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>
        {event.address ? (
          <View style={styles.addressRow}>
            <MapPin size={11} color={colors.brand.textSecondary} />
            <Text style={styles.address} numberOfLines={1}>
              {event.address}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: MAP_RESULT_CARD_WIDTH,
    height: CARD_HEIGHT,
    flexDirection: 'row',
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  cardActive: {
    borderColor: colors.primary[500],
    shadowColor: colors.primary[600],
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.92,
  },
  image: {
    width: 88,
    height: '100%',
    backgroundColor: colors.neutral[200],
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  title: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '700',
    flex: 1,
  },
  detailsLink: {
    ...typography.caption,
    color: colors.primary[500],
    fontWeight: '600',
  },
  date: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveBadge: {
    backgroundColor: colors.brand.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  category: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
    fontSize: 11,
  },
});
