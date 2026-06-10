import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Heart, X, Star } from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getCategoryLabel } from '@/constants/categories';
import { isEventLive } from '@/utils/event-status';

/** Peek band height so the card floats above the bottom sheet strip. */
const VIEWPORT_PEEK_OFFSET = 88;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing.md * 2;
const IMAGE_HEIGHT = Math.round(CARD_WIDTH * 0.62);
const DEFAULT_EVENT_IMAGE = require('../../../assets/images/icon.png');

interface Props {
  event: EventWithCreator;
  visible: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress: () => void;
  onClose: () => void;
  bottomInset?: number;
}

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none') return null;
  return trimmed;
};

function formatDateRange(starts_at: string, ends_at?: string | null) {
  const start = new Date(starts_at);
  if (Number.isNaN(start.getTime())) return '';
  const startLabel = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (!ends_at) {
    const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${startLabel} · ${time}`;
  }
  const end = new Date(ends_at);
  if (Number.isNaN(end.getTime())) return startLabel;
  const endLabel = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${startLabel} – ${endLabel}`;
}

export const MapEventUnitOverlay: React.FC<Props> = ({
  event,
  visible,
  isFavorite = false,
  onToggleFavorite,
  onPress,
  onClose,
  bottomInset = spacing.md,
}) => {
  const progress = useSharedValue(0);
  const imageUri = useMemo(() => normalizeImageUrl(event.cover_url), [event.cover_url]);
  const isLive = isEventLive(event);
  const categoryLabel = getCategoryLabel(event.category || '');

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 320 : 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [progress, visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 48 },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrapper, { bottom: bottomInset + VIEWPORT_PEEK_OFFSET }, cardStyle]}
    >
      <Pressable style={styles.card} onPress={onPress}>
        <View style={styles.imageWrap}>
          <Image
            source={imageUri ? { uri: imageUri } : DEFAULT_EVENT_IMAGE}
            style={styles.image}
          />
          {isLive ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>EN DIRECT</Text>
            </View>
          ) : null}
          <View style={styles.imageActions}>
            {onToggleFavorite ? (
              <TouchableOpacity style={styles.roundButton} onPress={onToggleFavorite} hitSlop={8}>
                <Heart
                  size={18}
                  color={isFavorite ? colors.brand.error : colors.brand.text}
                  fill={isFavorite ? colors.brand.error : 'transparent'}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.roundButton} onPress={onClose} hitSlop={8}>
              <X size={18} color={colors.brand.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {categoryLabel}
            {event.address ? ` · ${event.address}` : ''}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.ratingRow}>
              <Star size={12} color={colors.brand.text} fill={colors.brand.text} />
              <Text style={styles.ratingText}>Nouveau</Text>
            </View>
            <Text style={styles.dateText}>{formatDateRange(event.starts_at, event.ends_at)}</Text>
          </View>
        </View>
      </Pressable>
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
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  card: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: colors.neutral[200],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  liveBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.brand.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  liveBadgeText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
  },
  imageActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  title: {
    ...typography.body,
    color: '#1a1a1b',
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: '#65676b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...typography.caption,
    color: '#1a1a1b',
    fontWeight: '600',
  },
  dateText: {
    ...typography.caption,
    color: '#65676b',
    fontWeight: '500',
  },
});
