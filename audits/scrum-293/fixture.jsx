import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AgendaSwipeAction, useAgendaSwipeActions } from '../../src/components/agenda/AgendaSwipeAction';
import { colors } from '../../src/constants/theme';

const review = { calls: 0, opened: 0 };
window.__swipeReview = review;
function Fixture() {
  const { closeSwipe, handleSwipeStart } = useAgendaSwipeActions();
  const [pending, setPending] = useState(false);
  const [removed, setRemoved] = useState([]);
  const [error, setError] = useState(false);
  review.finish = (fail) => { setPending(false); setError(fail); if (!fail) setRemoved(ids => [...ids, review.target]); };
  const remove = (id) => { if (pending) return; review.calls++; review.target = id; setPending(true); setError(false); };
  return <GestureHandlerRootView style={{ height: '100vh', backgroundColor: colors.brand.page }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Changer de jour" onPress={closeSwipe} style={{ padding: 20 }}><Text>Changer de jour</Text></Pressable>
    {error && <Text accessibilityRole="alert">Retrait non confirmé — réessayer</Text>}
    <ScrollView testID="list" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      {Array.from({ length: 8 }, (_, id) => id).filter(id => !removed.includes(id)).map(id => <View key={id} testID={`row-${id}`}>
        <AgendaSwipeAction title={`Moment ${id + 1}`} pending={pending && review.target === id} onRemove={() => remove(id)} onSwipeStart={handleSwipeStart}>
          <View style={{ height: 160, justifyContent: 'center', padding: 16, borderBottomWidth: 1, borderColor: colors.brand.line }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir Moment ${id + 1}`} onPress={() => review.opened++}><Text style={{ fontSize: 20 }}>Moment {id + 1}</Text></Pressable>
            <Text>Contenu de carte simulé · geste réel</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Retirer avec le cœur ${id + 1}`} disabled={pending} onPress={() => remove(id)} style={{ padding: 12 }}><Text>♥</Text></Pressable>
          </View>
        </AgendaSwipeAction>
      </View>)}
    </ScrollView>
  </GestureHandlerRootView>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
