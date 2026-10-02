import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, TouchableOpacity } from 'react-native';
import { MapFiltersSheet, defaultViewportDraft } from '../../src/components/search/MapFiltersSheet';
import { brandFontAssets } from '../../src/constants/fonts';

function Fixture() {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(defaultViewportDraft);
  const [context, setContext] = useState('agenda');
  window.__agendaFilters = value;
  return <View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ouvrir filtres agenda" onPress={() => { setContext('agenda'); setVisible(true); }}><Text>Filtres agenda</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ouvrir filtres carte" onPress={() => { setContext('map'); setVisible(true); }}><Text>Filtres carte</Text></TouchableOpacity>
    <MapFiltersSheet context={context} visible={visible} value={value} onApply={setValue} onClose={() => setVisible(false)} />
  </View>;
}
Promise.all(Object.entries(brandFontAssets).map(async ([name, uri]) => {
  document.fonts.add(await new FontFace(name, `url(${uri})`).load());
})).then(() => createRoot(document.getElementById('root')).render(<Fixture />));
