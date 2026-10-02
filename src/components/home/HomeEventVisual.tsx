import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { EventCoverImage } from '@/components/events/EventCoverImage';
import { getCategoryColor, getCategoryLabel } from '@/constants/categories';
import { getCategoryLucideIcon } from '@/constants/category-visuals';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { getEventImageUrls } from '@/utils/event-card-display';
import { homeCategorySlug } from '@/utils/home-feed';

export function useHomeCategory(event: EventWithCreator) {
  const category = useTaxonomyStore(state => state.categoriesMap[event.category || '']);
  const slug = category?.slug || homeCategorySlug(event);
  return { slug, color: getCategoryColor(category ? event.category || slug : slug), label: getCategoryLabel(event.category || slug, event.category_meta) };
}

export function HomeCategoryGlyph({ event, size = 26 }: { event: EventWithCreator; size?: number }) {
  const category = useHomeCategory(event);
  const Icon = getCategoryLucideIcon(category.slug);
  return <View accessible accessibilityRole="image" accessibilityLabel={category.label}>
    <Icon size={size} color={category.color} />
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
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderWidth: 1.5, borderColor: category.color, borderRadius: 16 }]} />
  </View>;
}

const styles = StyleSheet.create({ media: { overflow: 'hidden', borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' } });
