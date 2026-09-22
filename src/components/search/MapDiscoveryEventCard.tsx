import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EventWithCreator } from '@/types/database';
import type { EventCardStats } from '@/services/event-card-stats.service';
import { features } from '@/config/features';
import { EVENT_CARD_RADIUS } from '@/constants/event-card-variants';
import { colors, typography } from '@/constants/theme';
import { getCategoryColor, getCategoryLabel } from '@/constants/categories';
import { pickCategoryMetaSlug } from '@/constants/category-visuals';
import { getCategoryMapMarkerSource } from '@/constants/map-marker-assets';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { EventCoverImage } from '@/components/events/EventCoverImage';
import { EventHeartButton } from '@/components/events/EventHeartButton';
import { EventShareButton } from '@/components/events/EventShareButton';
import {
  getEventImageUrls, getEventLocationLabel, getEventPriceLabel,
  getEventSocialProofLabel, isMeaningfulPriceLabel,
} from '@/utils/event-card-display';
import { getEventCardDateStamp } from '@/utils/event-card-meta';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';

export type MapDiscoveryEventCardProps = {
  event: EventWithCreator;
  variant?: 'row' | 'spotlight';
  stats?: EventCardStats;
  liked: boolean;
  pending?: boolean;
  active?: boolean;
  distance?: string | null;
  onOpen: (event: EventWithCreator) => void;
  onHighlight?: (event: EventWithCreator) => void;
  onToggleHeart: (event: EventWithCreator) => void;
  onShare: (event: EventWithCreator) => void;
};

/** The viewport list and its Spotlight share real media, social data and category accents. */
export const MapDiscoveryEventCard = React.memo(function MapDiscoveryEventCard({
  event, variant = 'row', stats, liked, pending = false, active = false, distance,
  onOpen, onHighlight, onToggleHeart, onShare,
}: MapDiscoveryEventCardProps) {
  const { width, fontScale } = useWindowDimensions();
  const categories = useTaxonomyStore((state) => state.categoriesMap);
  const category = categories[event.category ?? ''] ? event.category : pickCategoryMetaSlug(event.category_meta) || event.category || '';
  const categoryColor = getCategoryColor(category || '');
  const categoryMarker = getCategoryMapMarkerSource(categories[category || '']?.slug || category);
  const compact = width < 360;
  const rowSize = (compact ? 124 : 140) + Math.min(24, Math.max(0, fontScale - 1) * 40);
  const label = getCategoryLabel(event.category || '', event.category_meta);
  const cover = getEventImageUrls(event)[0];
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const spotlight = variant === 'spotlight';
  const count = stats?.likesCount ?? event.likes_count ?? 0;
  const likers = features.socialPeers ? (stats?.likers ?? []).slice(0, 3) : [];
  const socialLabel = getEventSocialProofLabel({
    likesCount: count, isLiked: liked,
    followedNames: features.socialPeers ? stats?.likers.filter((person) => person.is_followed).map((person) => person.display_name) : [],
  });
  const price = getEventPriceLabel(event);
  const stamp = getEventCardDateStamp(event);
  const location = [getEventLocationLabel(event), distance].filter(Boolean).join(' · ');
  const dateStamp = <View style={[styles.dateStamp, spotlight && styles.coverDate]} pointerEvents="none" accessible accessibilityLabel={stamp.label}>
    <Text style={styles.stampDate} maxFontSizeMultiplier={1.3}>{stamp.primary}</Text>
    {stamp.secondary ? <Text style={[styles.stampTime, spotlight && stamp.kind === 'time' && styles.spotlightTime]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{stamp.secondary}</Text> : null}
  </View>;
  const open = () => onOpen(event);
  const media = (
    <Pressable
      onPress={open}
      onPressIn={() => prefetchEventMedia(event)}
      onLongPress={onHighlight ? () => onHighlight(event) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${event.title}`}
      style={[styles.media, spotlight ? styles.spotlightMedia : [styles.rowMedia, { width: rowSize, height: rowSize }], { backgroundColor: `${categoryColor}18` }]}
    >
      {cover && failedCover !== cover ? (
        <EventCoverImage uri={cover} recyclingKey={`${event.id}:${cover}`} variant="list" style={styles.cover} onError={() => setFailedCover(cover)} />
      ) : <BrandIcon name="sparkles" size={36} fillColor={categoryColor} />}
      {spotlight ? dateStamp : null}
      {spotlight && isMeaningfulPriceLabel(price) ? (
        <View style={styles.coverPrice}><Text style={styles.price}>{price}</Text></View>
      ) : null}
    </Pressable>
  );
  return (
    <View testID={`map-event-${variant}-${event.id}`} style={[styles.card, spotlight ? styles.spotlight : styles.row, active && { borderColor: categoryColor }]}>
      {media}
      <View testID="event-card-body" style={[styles.body, spotlight ? styles.spotlightBody : { height: rowSize }]}>
        <View style={styles.heading}>
          <Pressable onPress={open} onPressIn={() => prefetchEventMedia(event)} accessibilityRole="button" accessibilityLabel={`Détails : ${event.title}`} accessibilityHint={stamp.label} style={styles.titleTarget}>
            <Text style={styles.location} numberOfLines={1} maxFontSizeMultiplier={1.3}>{location}</Text>
            <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{event.title}</Text>
          </Pressable>
          {!spotlight ? dateStamp : null}
        </View>
        <View testID="event-card-social" style={styles.social}>
          <View style={styles.socialPeople} accessible accessibilityLabel={socialLabel}>
            {likers.length ? <View style={styles.avatars} accessible={false}>
              {likers.map((person, index) => <UserAvatar key={person.id} uri={person.avatar_url} name={person.display_name} size={22} style={{ marginLeft: index ? -6 : 0 }} />)}
            </View> : <Text style={styles.socialText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{socialLabel}</Text>}
          </View>
          {!spotlight && isMeaningfulPriceLabel(price) ? <Text style={styles.price} numberOfLines={1} maxFontSizeMultiplier={1.3}>{price}</Text> : null}
        </View>
        <View testID="event-card-actions" style={styles.actions}>
          <View style={styles.category} accessible accessibilityRole="image" accessibilityLabel={label || 'Catégorie de l’événement'}>
            {categoryMarker ? (
              <Image source={categoryMarker} style={styles.categoryImage} resizeMode="contain" accessible={false} />
            ) : (
              <BrandIcon name="sparkles" size={28} fillColor={categoryColor} />
            )}
          </View>
          <View style={styles.actionSpacer} />
          <EventHeartButton active={liked} disabled={pending} count={count} compactCount onPress={() => onToggleHeart(event)} accessibilityLabel={`${liked ? 'Ne plus aimer' : 'Aimer'} ${event.title}, ${count} j’aime`} />
          <EventShareButton compact={!spotlight && compact} onPress={() => onShare(event)} accessibilityLabel={`Partager ${event.title}`} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: EVENT_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.brand.surfaceMuted,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  spotlight: { width: 235 },
  media: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowMedia: { flexShrink: 0 },
  spotlightMedia: { width: '100%', aspectRatio: 1, flexShrink: 0 },
  cover: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  coverPrice: { position: 'absolute', bottom: 8, right: 8, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.brand.page },
  body: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
  spotlightBody: { flex: 0, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10, gap: 6 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  location: { ...typography.caption, fontSize: 10, lineHeight: 14, color: colors.brand.textSecondary },
  titleTarget: { minHeight: 48, flex: 1, minWidth: 0 },
  title: { ...typography.bodySmall, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand.text },
  dateStamp: { flexDirection: 'column', flexShrink: 0, maxWidth: 92, paddingHorizontal: 5, paddingVertical: 5, borderRadius: 9, backgroundColor: colors.brand.page, alignItems: 'center' },
  coverDate: { position: 'absolute', top: 8, right: 8, padding: 7, borderRadius: 10, backgroundColor: colors.brand.page },
  stampDate: { ...typography.caption, fontSize: 9, lineHeight: 12, color: colors.brand.text },
  stampTime: { ...typography.caption, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand.text },
  spotlightTime: { fontSize: 14, lineHeight: 18 },
  social: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, minHeight: 22 },
  socialPeople: { flexShrink: 1, minWidth: 0 },
  avatars: { flexDirection: 'row' },
  socialText: { ...typography.caption, fontSize: 10, lineHeight: 14, color: colors.brand.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34 },
  actionSpacer: { flex: 1 },
  category: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  categoryImage: { width: 32, height: 32 },
  price: { ...typography.caption, fontSize: 10, fontWeight: '700', color: colors.brand.text },
});
