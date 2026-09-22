// QA only: real components with synthetic data, no product route or network account.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SearchResultsBottomSheet } from '../../src/components/search/SearchResultsBottomSheet';
import { UiReliefFixture } from '../../src/components/ui/UiReliefFixture';
import { applyTaxonomyCache } from '../../src/store/taxonomyStore';
import { getCategoryColor } from '../../src/constants/categories';

const categories = [
  { id: 'art', slug: 'arts-culture', label: 'Arts & culture', color: '#8B5CF6' },
  { id: 'nature', slug: 'nature-bienetre', label: 'Nature & bien-être', color: '#22C55E' },
  { id: 'food', slug: 'gastronomie-saveurs', label: 'Gastronomie & saveurs', color: '#F97316' },
];
applyTaxonomyCache({ categories, tags: [], subcategories: [] });
const cover = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="${color}"/><circle cx="310" cy="50" r="35" fill="#ffffff88"/><path d="m0 230 110-140 100 100 80-95 110 135v20H0" fill="#ffffff66"/></svg>`)}`;
const events = Array.from({ length: 110 }, (_, i) => ({
  id: `event-${i}`, title: i === 0 ? 'Les soirées du jardin partagé' : i === 1 ? 'Une rencontre avec les artistes et artisans du village' : `Moment du quartier ${i + 1}`,
  status: 'published', starts_at: i === 1 ? '2026-06-01T10:00:00Z' : `2026-09-${26 + i % 2}T14:30:00Z`,
  ends_at: i === 1 ? '2026-09-30T18:00:00Z' : `2026-09-${26 + i % 2}T18:00:00Z`,
  created_at: new Date(Date.UTC(2026, 8, 20, 0, i)).toISOString(), city: 'Nyons', venue_name: 'Le jardin partagé',
  category: categories[i % 3].id, cover_url: i === 2 ? null : cover(categories[i % 3].color), media: [],
  is_free: i % 2 === 0, price: i % 2 ? 18 : null, likes_count: 24, latitude: 44.36 + i * .001, longitude: 5.14,
}));
const stats = Object.fromEntries(events.map(event => [event.id, { viewsCount: 12, friendsGoingCount: 0, likesCount: event.id === 'event-2' ? 12345 : 24, likers: [{ id: 'peer', display_name: 'Léa', avatar_url: 'preset:sauge', is_followed: true }] }]));
window.__reviewStats = stats;

function App() {
  const [mode, setMode] = useState('sheet');
  const [snap, setSnap] = useState(1);
  const [sortBy, setSortBy] = useState('triage');
  const [sortOrder, setSortOrder] = useState('asc');
  const [likes, setLikes] = useState(new Set());
  const [active, setActive] = useState();
  const [notice, setNotice] = useState('');
  const sheet = useRef(null);
  const state = useRef({ calls: 0, fail: false });
  const progress = useSharedValue(1);
  const visible = useSharedValue(760);
  const min = useSharedValue(56);
  const max = useSharedValue(760);
  const layout = useSharedValue(830);
  const snapTo = (value) => { setSnap(value); progress.value = value; visible.value = value ? 760 : 56; };
  window.__uiReview = {
    likes: [...likes], calls: state.current.calls, snap, sortBy, notice,
    colors: categories.map(category => getCategoryColor(category.id)),
    setFail: (value) => { state.current.fail = value; },
    select: (id) => { setActive(id); sheet.current?.scrollToEvent(id); },
    sort: (value, order = 'asc') => { setSortBy(value); setSortOrder(order); },
    home: () => { setActive(undefined); setSortBy('triage'); },
  };
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F4FBF6' }}>
    <View style={{ padding: 12, gap: 8 }}><Text style={{ fontWeight: '700', fontSize: 16 }}>Duo végétal · composants réels</Text><View style={{ flexDirection: 'row', gap: 12 }}>{['sheet', 'detail'].map(value => <Pressable key={value} accessibilityRole="button" onPress={() => setMode(value)} style={{ minHeight: 44, padding: 10 }}><Text>{value === 'sheet' ? 'Bottom sheet' : 'Fiche et icônes'}</Text></Pressable>)}</View></View>
    {mode === 'detail' ? <ScrollView><UiReliefFixture /></ScrollView> : <View style={{ flex: 1, paddingTop: snap ? 0 : 400 }}>
      <SearchResultsBottomSheet ref={sheet} events={events} currentUserId="me" activeEventId={active}
        sheetProgress={progress} sheetVisibleHeight={visible} minSheetHeight={min} maxSheetHeight={max} layoutHeight={layout}
        snapIndex={snap} onSnapIndexChange={snapTo} onSheetDragStart={() => {}} onSheetDragEnd={snapTo} onSheetSnapSettled={snapTo} onSheetDragCancel={() => {}}
        onSelectEvent={event => setActive(event.id)} onHighlightEvent={event => setActive(event.id)} onNavigate={event => setNotice(`navigation:${event.id}`)}
        onOpenDetails={event => setNotice(`detail:${event.id}`)}
        onToggleHeart={async event => {
          state.current.calls += 1;
          await new Promise(resolve => setTimeout(resolve, 300));
          if (state.current.fail) return null;
          const beforeLiked = likes.has(event.id);
          setLikes(previous => { const next = new Set(previous); beforeLiked ? next.delete(event.id) : next.add(event.id); return next; });
          return { beforeLiked, afterLiked: !beforeLiked };
        }}
        isHearted={id => likes.has(id)} mode="viewport" peekCount={events.length}
        sortBy={sortBy} sortOrder={sortOrder} onSortByChange={setSortBy} onSortChange={(value, order) => { setSortBy(value); setSortOrder(order); }}
        hasLocation sortCenter={center} bottomContentInset={90}
      />
    </View>}
    {notice ? <Text accessibilityRole="status" style={{ padding: 8 }}>{notice}</Text> : null}
  </GestureHandlerRootView>;
}
const center = { latitude: 44.36, longitude: 5.14 };
createRoot(document.getElementById('root')).render(<App />);
