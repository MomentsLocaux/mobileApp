import React, { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { EventCoverImage } from '@/components/events/EventCoverImage';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { getCategoryColor, getCategoryLabel } from '@/constants/categories';
import { getCategoryMapMarkerSource } from '@/constants/map-marker-assets';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { getEventImageUrls } from '@/utils/event-card-display';
import { homeCategorySlug } from '@/utils/home-feed';

export function useHomeCategory(event: EventWithCreator) {
  const category = useTaxonomyStore(state => state.categoriesMap[event.category || '']);
  const slug = category?.slug || homeCategorySlug(event);
  return { source: getCategoryMapMarkerSource(slug), color: getCategoryColor(category ? event.category || slug : slug), label: getCategoryLabel(event.category || slug, event.category_meta) };
}

export function HomeCategoryGlyph({ event, size = 26 }: { event: EventWithCreator; size?: number }) {
  const category = useHomeCategory(event);
  return <View accessible accessibilityRole="image" accessibilityLabel={category.label}>
    {category.source ? <Image source={category.source} style={{ width: size, height: size }} resizeMode="contain" accessible={false} /> : <BrandIcon name="sparkles" size={size} fillColor={category.color} />}
  </View>;
}

/** Shared compact media: category silhouette remains available while a cover loads or fails. */
export function HomeEventVisual({ event, style }: { event: EventWithCreator; style?: StyleProp<ViewStyle> }) {
  const uri = getEventImageUrls(event)[0];
  const [failed, setFailed] = useState<string | null>(null);
  const category = useHomeCategory(event);
  return <View style={[styles.media, { backgroundColor: `${category.color}18`, borderColor: category.color }, style]}>
    <HomeCategoryGlyph event={event} size={48} />
    {uri && uri !== failed ? <EventCoverImage uri={uri} recyclingKey={event.id} variant="list" style={StyleSheet.absoluteFillObject} onError={() => setFailed(uri)} /> : null}
  </View>;
}

const styles = StyleSheet.create({ media: { overflow: 'hidden', borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' } });
