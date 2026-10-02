import { brandFontAssets } from '../../src/constants/fonts';
import { MapDiscoveryEventCard } from '../../src/components/search/MapDiscoveryEventCard';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { CategoryFilterSelector } from '../../src/components/filters/CategoryFilterSelector';
import { EventDurationSelector } from '../../src/components/filters/EventDurationSelector';
import { CATEGORY_VISUALS, CATEGORY_VISUAL_LABELS } from '../../src/constants/category-visuals';
import { colors } from '../../src/constants/theme';
import { useTaxonomyStore } from './taxonomy';

function Fixture() {
  const [categories, setCategories] = useState([]);
  const [duration, setDuration] = useState([]);
  window.__selection = { categories, duration };
  return <View style={{ padding: 16, gap: 24, backgroundColor: colors.brand.page }}>
    <Text style={{ fontSize: 22, color: colors.brand.text }}>Catégories & durée</Text>
    <EventDurationSelector values={duration} onChange={setDuration} testID="duration" />
    <CategoryFilterSelector categories={useTaxonomyStore.getState().categories} values={categories} onChange={setCategories} testID="categories" />
    {['feed', 'row', 'spotlight'].map(variant => <MapDiscoveryEventCard key={variant} variant={variant}
      event={{ id: variant, title: 'Marché des artisans', category: 'category-1', cover_url: 'fixture-cover', starts_at: '2026-10-03T10:00:00Z', ends_at: '2026-10-03T18:00:00Z', city: 'Lyon' }}
      liked={false} onOpen={() => { window.__opened = (window.__opened || 0) + 1; }} onToggleHeart={() => {}} onShare={() => {}} />)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {Object.entries(CATEGORY_VISUALS).map(([slug, { Icon, fallbackColor }]) => <View key={slug} style={{ width: 96, alignItems: 'center', gap: 8 }}>
        <Icon size={40} color={fallbackColor} /><Text style={{ fontSize: 12, textAlign: 'center' }}>{CATEGORY_VISUAL_LABELS[slug]}</Text>
      </View>)}
    </View>
  </View>;
}
Promise.all(Object.entries(brandFontAssets).map(async ([name, uri]) => {
  const font = await new FontFace(name, `url(${uri})`).load();
  document.fonts.add(font);
})).then(() => createRoot(document.getElementById('root')).render(<Fixture />));
