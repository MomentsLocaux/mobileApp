import React from 'react';
import { createRoot } from 'react-dom/client';
import { Pressable, Text, View } from 'react-native';
import { MapSearchAreaControls } from '../../src/components/map/MapSearchAreaControls';
import { colors } from '../../src/constants/theme';

const review = { search: 0, tighten: 0, map: 0 };
window.__areaReview = review;
function Sample({ title, pending = true, loading = false, tooLarge = false, showWarning = false }) {
  return <View testID={title} style={{ marginBottom: 16 }}>
    <Text style={{ padding: 16, color: colors.brand.text }}>{title}</Text>
    <View style={{ height: 260, backgroundColor: colors.brand.surface }}>
      <Pressable accessibilityLabel="Fond carte" onPress={() => review.map++} style={{ position: 'absolute', inset: 0 }} />
      <MapSearchAreaControls pending={pending} loading={loading} tooLarge={tooLarge} showWarning={showWarning}
        onSearch={() => review.search++} onTighten={() => review.tighten++} />
    </View>
  </View>;
}
createRoot(document.getElementById('root')).render(<View style={{ backgroundColor: colors.brand.page }}>
  <Sample title="Recherche disponible" />
  <Sample title="Recherche en cours" loading />
  <Sample title="Zone trop large" tooLarge showWarning />
  <Sample title="Alerte seule" pending={false} showWarning />
  <Sample title="Aucune action" pending={false} />
</View>);
