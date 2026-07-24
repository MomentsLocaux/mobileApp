import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import {
  Calendar,
  Clock,
  Eye,
  Heart,
  MapPin,
  Ticket,
} from 'lucide-react-native';
import type { EventWithCreator } from '@/types/database';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Motion } from '@/constants/motion';
import { haptics } from '@/utils/haptics';
import { getCategoryColor, getCategoryLabel, getCategoryTextColor } from '@/constants/categories';
import {
  EVENT_CARD_CTA,
  EVENT_CARD_MEDIA_HEIGHT,
  EVENT_CARD_RADIUS,
  type EventCardVariant,
} from '@/constants/event-card-variants';
import {
  formatDistanceLabel,
  getEventAccessLabel,
  getEventContextTags,
  getEventDescriptionPreview,
  getEventImageUrls,
  getEventLocationLabel,
  getEventPriceLabel,
  getEventSocialProofLabel,
  getEventTemporalState,
  getHumanizedDate,
  isMeaningfulAccessLabel,
  isMeaningfulPriceLabel,
  MIN_VIEWS_BADGE_THRESHOLD,
} from '@/utils/event-card-display';
import { getEventLiveWindow } from '@/utils/event-status';
import { EventCoverPlaceholder } from './EventCoverPlaceholder';
import { EventImageCarousel } from './EventImageCarousel';

/** Tokens alignés DESIGN.md (§2 Couleurs, §4 Boutons/Cards). */
const CARD_THEME = {
  accent: colors.brand.secondary,
  accentSoft: 'rgba(43, 191, 227, 0.12)',
  accentBorder: 'rgba(43, 191, 227, 0.35)',
  text: colors.brand.text,
  textSecondary: colors.brand.textSecondary,
  surface: colors.brand.surface,
  primary: colors.brand.primary,
  success: colors.brand.success,
  error: colors.brand.error,
  onAccent: colors.neutral[0],
};

export interface EventCardProps {
  event: EventWithCreator;
  variant?: EventCardVariant;
  onPress: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onHeartPress?: () => void;
  onNavigate?: () => void;
  isFavorite?: boolean;
  isLiked?: boolean;
  isParticipating?: boolean;
  distanceKm?: number;
  distanceLabel?: string | null;
  viewsCount?: number;
  friendsGoingCount?: number;
  showCarousel?: boolean;
  style?: ViewStyle;
  noBottomMargin?: boolean;
}

const EventCardComponent: React.FC<EventCardProps> = ({
  event,
  variant = 'discovery',
  onPress,
  onPrimaryAction,
  onSecondaryAction,
  onHeartPress,
  onNavigate,
  isFavorite = false,
  isLiked = false,
  isParticipating = false,
  distanceKm,
  distanceLabel,
  viewsCount = 0,
  friendsGoingCount = 0,
  showCarousel = true,
  style,
  noBottomMargin = false,
}) => {
  const [isSwiping, setIsSwiping] = useState(false);

  const images = useMemo(() => getEventImageUrls(event), [event.cover_url, event.media]);
  const hasCarousel = showCarousel && images.length > 1;
  const mediaHeight = EVENT_CARD_MEDIA_HEIGHT[variant];
  const categoryLabel = getCategoryLabel(event.category || '').toUpperCase();
  const categoryColor = getCategoryColor(event.category || '');
  const categoryTextColor = getCategoryTextColor(event.category || '');
  const contextTags = getEventContextTags(event);
  const description = getEventDescriptionPreview(event.description, variant === 'compact' ? 0 : 140);
  const locationLabel = getEventLocationLabel(event);
  const distance = formatDistanceLabel(distanceKm, distanceLabel);
  const humanDate = getHumanizedDate(event);
  const priceLabel = getEventPriceLabel(event);
  const accessLabel = getEventAccessLabel(event);
  const temporal = getEventTemporalState(event);
  const participating = isParticipating || Boolean(event.is_interested);
  const socialLabel = getEventSocialProofLabel(
    friendsGoingCount,
    (event.interests_count || 0) + (event.checkins_count || 0)
  );
  const viewCount = Number.isFinite(viewsCount) ? Number(viewsCount) : 0;
  const viewsLabel = `${viewCount} vue${viewCount > 1 ? 's' : ''}`;
  const { isLive } = useMemo(() => getEventLiveWindow(event), [event]);
  const showPriceBadge = isMeaningfulPriceLabel(priceLabel);
  const showAccessBadge = isMeaningfulAccessLabel(accessLabel);
  const showViewsBadge = viewCount >= MIN_VIEWS_BADGE_THRESHOLD;
  const hasSocialProof =
    (Number.isFinite(friendsGoingCount) && Number(friendsGoingCount) > 0) ||
    (event.interests_count || 0) + (event.checkins_count || 0) > 0;

  const showDescription = Boolean(description) && variant !== 'compact' && variant !== 'map-preview';
  const showSchedulePanel = variant === 'discovery' || variant === 'favorite';
  const showMetaBadges =
    variant !== 'map-preview' &&
    (showPriceBadge || showAccessBadge || showViewsBadge || temporal === 'cancelled');
  const showSocial = variant !== 'compact' && hasSocialProof;
  const showFooter = variant === 'favorite';
  const canNavigate = Boolean(onNavigate);
  const heartActive = isLiked || isFavorite;
  const showHeart = Boolean(onHeartPress);

  const heartScale = useSharedValue(1);
  const wasHeartActiveRef = useRef(heartActive);
  useEffect(() => {
    if (heartActive && !wasHeartActiveRef.current) {
      heartScale.value = withSequence(
        withSpring(1.3, Motion.spring.snappy),
        withSpring(1, Motion.spring.soft)
      );
    }
    wasHeartActiveRef.current = heartActive;
  }, [heartActive, heartScale]);
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const primaryCta = useMemo(() => {
    if (variant === 'favorite') {
      if (temporal === 'past') return EVENT_CARD_CTA.favoritePast;
      if (temporal === 'cancelled') return EVENT_CARD_CTA.favoriteDetails;
      if (participating) return EVENT_CARD_CTA.favoriteParticipating;
      if (accessLabel === 'Complet') return EVENT_CARD_CTA.favoriteDetails;
      return EVENT_CARD_CTA.favoriteGoing;
    }
    if (variant === 'map-preview' || variant === 'compact') return EVENT_CARD_CTA.mapPreview;
    return EVENT_CARD_CTA.discovery;
  }, [accessLabel, participating, temporal, variant]);

  const primaryDisabled =
    variant === 'favorite' &&
    (temporal === 'cancelled' || accessLabel === 'Complet') &&
    !participating &&
    temporal !== 'past';

  const handlePrimaryPress = () => {
    if (primaryDisabled) return;
    if (variant === 'favorite') {
      if (participating) {
        onNavigate?.();
        return;
      }
      if (temporal !== 'past') {
        onPrimaryAction?.() ?? onNavigate?.();
        return;
      }
      onSecondaryAction?.() ?? onPress();
      return;
    }
    onPrimaryAction?.() ?? onPress();
  };

  const handleCardPress = () => {
    if (isSwiping) return;
    onPress();
  };

  const mediaSection = hasCarousel ? (
    <EventImageCarousel
      images={images}
      height={mediaHeight}
      borderRadius={0}
      onSwipeStart={() => setIsSwiping(true)}
      onSwipeEnd={() => setIsSwiping(false)}
    />
  ) : images[0] ? (
    <Image source={{ uri: images[0] }} style={[styles.mediaImage, { height: mediaHeight }]} />
  ) : (
    <EventCoverPlaceholder category={event.category} height={mediaHeight} />
  );

  const locationContent = (
    <>
      <MapPin size={13} color={CARD_THEME.accent} />
      <Text
        style={[styles.locationText, canNavigate && styles.locationTextTappable]}
        numberOfLines={1}
      >
        {locationLabel}
      </Text>
      {distance ? <Text style={styles.distanceInline}>{distance}</Text> : null}
    </>
  );

  return (
    <View style={[styles.card, noBottomMargin && styles.cardNoMargin, style]}>
      <Pressable onPress={handleCardPress} style={styles.pressable}>
        <View style={[styles.mediaWrap, { height: mediaHeight }]}>
          {mediaSection}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={styles.mediaGradient}
          />

          <View style={styles.mediaTopRow} pointerEvents="box-none">
            <View style={styles.badgeCol}>
              {isLive ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>EN DIRECT</Text>
                </View>
              ) : null}
              <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                <Text style={[styles.categoryText, { color: categoryTextColor }]}>{categoryLabel}</Text>
              </View>
              {contextTags.map((tag) => (
                <View key={tag} style={styles.contextBadge}>
                  <Text style={styles.contextText}>{tag}</Text>
                </View>
              ))}
            </View>

            {showHeart ? (
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={(e) => {
                  e.stopPropagation?.();
                  haptics.light();
                  onHeartPress?.();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={heartActive ? 'Retirer des favoris' : 'Aimer et enregistrer'}
                disabled={!onHeartPress}
              >
                <Animated.View style={heartAnimatedStyle}>
                  <Heart
                    size={22}
                    color={heartActive ? CARD_THEME.accent : CARD_THEME.onAccent}
                    fill={heartActive ? CARD_THEME.accent : 'rgba(0,0,0,0.25)'}
                  />
                </Animated.View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={[styles.body, variant === 'compact' && styles.bodyCompact]}>
          <View style={styles.titleRow}>
            <View style={styles.mainCol}>
              <Text style={[styles.title, variant === 'compact' && styles.titleCompact]} numberOfLines={2}>
                {event.title}
              </Text>
              {showDescription ? (
                <Text style={styles.description} numberOfLines={2}>
                  {description}
                </Text>
              ) : null}

              {canNavigate ? (
                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onNavigate?.();
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Itinéraire vers ${locationLabel}`}
                  activeOpacity={0.7}
                >
                  {locationContent}
                </TouchableOpacity>
              ) : (
                <View style={styles.locationRow}>{locationContent}</View>
              )}
            </View>

            {showSchedulePanel ? (
              <View style={styles.schedulePanel}>
                <View style={styles.scheduleBlock}>
                  <Text style={styles.scheduleLabel}>DÉBUT</Text>
                  <Text style={styles.scheduleDate} numberOfLines={2}>
                    {humanDate.startDate}
                  </Text>
                  <View style={styles.scheduleTimeRow}>
                    <Clock size={12} color={CARD_THEME.accent} />
                    <Text style={styles.scheduleTime}>{humanDate.startTime}</Text>
                  </View>
                </View>
                <View style={styles.scheduleDivider} />
                <View style={styles.scheduleBlock}>
                  <Text style={styles.scheduleLabel}>FIN</Text>
                  <Text style={styles.scheduleDate} numberOfLines={2}>
                    {humanDate.endDate}
                  </Text>
                  <View style={styles.scheduleTimeRow}>
                    <Clock size={12} color={CARD_THEME.accent} />
                    <Text style={styles.scheduleTime}>{humanDate.endTime}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.compactScheduleCol}>
                {humanDate.headline ? <Text style={styles.headline}>{humanDate.headline}</Text> : null}
                <Text style={styles.compactDateLine} numberOfLines={2}>
                  {humanDate.startLine}
                </Text>
              </View>
            )}
          </View>

          {showMetaBadges ? (
            <View style={styles.metaBadgesRow}>
              {showPriceBadge ? (
                <View style={styles.metaBadge}>
                  <Ticket size={12} color={CARD_THEME.accent} />
                  <Text style={styles.metaBadgeText}>{priceLabel}</Text>
                </View>
              ) : null}
              {showAccessBadge ? (
                <View style={styles.metaBadge}>
                  <Calendar size={12} color={CARD_THEME.accent} />
                  <Text style={styles.metaBadgeText}>{accessLabel}</Text>
                </View>
              ) : null}
              {showViewsBadge ? (
                <View style={styles.metaBadge}>
                  <Eye size={12} color={CARD_THEME.accent} />
                  <Text style={styles.metaBadgeText}>{viewsLabel}</Text>
                </View>
              ) : null}
              {temporal === 'cancelled' ? (
                <View style={[styles.metaBadge, styles.cancelledBadge]}>
                  <Text style={styles.cancelledText}>Annulé</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {humanDate.headline && showSchedulePanel ? (
            <Text style={styles.headline}>{humanDate.headline}</Text>
          ) : null}

          {showSocial ? (
            <View style={styles.socialRow}>
              <Text style={styles.socialText}>{socialLabel}</Text>
            </View>
          ) : null}

          {showFooter ? (
            <View style={styles.footerRow}>
              <View style={styles.statsCol} />
              <View style={styles.ctaColFavorite}>
                {participating ? (
                  <Text style={styles.participatingLabel}>{EVENT_CARD_CTA.favoriteParticipating}</Text>
                ) : null}
                <View style={styles.favoriteActionsRow}>
                  {temporal !== 'past' && !primaryDisabled ? (
                    <TouchableOpacity
                      style={[styles.primaryCta, primaryDisabled && styles.primaryCtaDisabled]}
                      onPress={handlePrimaryPress}
                      disabled={primaryDisabled}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryCtaText}>
                        {participating ? 'Itinéraire' : primaryCta}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.secondaryCta}
                    onPress={onSecondaryAction ?? onPress}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.secondaryCtaText}>{EVENT_CARD_CTA.favoriteDetails}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
};

export const EventCard = React.memo(EventCardComponent);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: EVENT_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.brand.surface,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardNoMargin: {
    marginBottom: 0,
  },
  pressable: {
    flex: 1,
  },
  mediaWrap: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.brand.primary,
  },
  mediaImage: {
    width: '100%',
    resizeMode: 'cover',
  },
  mediaGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  mediaTopRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeCol: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  liveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(239,68,68,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CARD_THEME.error,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: CARD_THEME.error,
    letterSpacing: 0.4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  contextBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  contextText: {
    fontSize: 11,
    fontWeight: '600',
    color: CARD_THEME.text,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bodyCompact: {
    padding: spacing.sm,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.brand.text,
    letterSpacing: -0.3,
  },
  titleCompact: {
    fontSize: 17,
    lineHeight: 21,
  },
  description: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  locationText: {
    ...typography.bodySmall,
    color: colors.brand.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  locationTextTappable: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(43, 191, 227, 0.45)',
  },
  distanceInline: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginLeft: 4,
  },
  schedulePanel: {
    width: '42%',
    maxWidth: 156,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.sm,
    gap: 6,
  },
  scheduleBlock: {
    gap: 2,
  },
  scheduleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand.textSecondary,
    letterSpacing: 0.5,
  },
  scheduleDate: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand.text,
    lineHeight: 14,
  },
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleTime: {
    fontSize: 11,
    fontWeight: '700',
    color: CARD_THEME.accent,
  },
  scheduleDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  compactScheduleCol: {
    maxWidth: '40%',
    alignItems: 'flex-end',
    gap: 2,
  },
  compactDateLine: {
    fontSize: 11,
    color: colors.brand.textSecondary,
    textAlign: 'right',
    fontWeight: '600',
  },
  headline: {
    fontSize: 12,
    fontWeight: '700',
    color: CARD_THEME.accent,
  },
  metaBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.brand.text,
  },
  cancelledBadge: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  cancelledText: {
    color: CARD_THEME.error,
    fontSize: 11,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  socialText: {
    fontSize: 12,
    fontWeight: '600',
    color: CARD_THEME.accent,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  statsCol: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  ctaColFavorite: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  participatingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: CARD_THEME.accent,
  },
  favoriteActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: CARD_THEME.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    minHeight: 44,
  },
  primaryCtaDisabled: {
    opacity: 0.45,
  },
  primaryCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: CARD_THEME.onAccent,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  secondaryCta: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: CARD_THEME.textSecondary,
    backgroundColor: 'transparent',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: CARD_THEME.textSecondary,
  },
});
