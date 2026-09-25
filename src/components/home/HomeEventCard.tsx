import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EventHeartButton } from '@/components/events/EventHeartButton';
import { colors, typography } from '@/constants/theme';
import type { EventWithCreator } from '@/types/database';
import { formatEventCardRangeLine, getEventCardCity } from '@/utils/event-card-meta';
import { HomeCategoryGlyph, HomeEventVisual } from './HomeEventVisual';

type Props = {
  event: EventWithCreator;
  distanceLabel?: string | null;
  reason?: string | null;
  hearted: boolean;
  pending?: boolean;
  onPress: () => void;
  onToggleHeart: () => void;
};

export function HomeEventCard({ event, distanceLabel, reason, hearted, pending, onPress, onToggleHeart }: Props) {
  const place = [event.venue_name || getEventCardCity(event), distanceLabel].filter(Boolean).join(' · ');
  return (
    <View style={styles.card} testID={`home-event-${event.id}`}>
      <View style={styles.coverWrap}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Voir ${event.title}`} onPress={onPress} style={styles.content}>
          <HomeEventVisual event={event} style={styles.cover} />
          {reason ? <View style={styles.reason}><Text numberOfLines={1} style={styles.reasonLabel}>{reason}</Text></View> : null}
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.schedule} numberOfLines={2}>{formatEventCardRangeLine(event, 'compact')}</Text>
          <Text style={styles.meta} numberOfLines={1}>{place || 'Lieu à découvrir'}</Text>
        </Pressable>
        <EventHeartButton
          appearance="overlay"
          active={hearted}
          disabled={pending}
          onPress={onToggleHeart}
          style={styles.heart}
          accessibilityLabel={`${hearted ? 'Retirer des favoris' : 'Enregistrer'} : ${event.title}`}
        />
      </View>
      <View style={styles.footer}>
        <HomeCategoryGlyph event={event} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { width: 190, padding: 8, borderRadius: 22, backgroundColor: colors.brand.surface, borderWidth: 1, borderColor: colors.primary[100] },
  content: { gap: 4 },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 112, marginBottom: 4 },
  reason: { position: 'absolute', top: 8, left: 8, right: 48, alignSelf: 'flex-start', alignItems: 'flex-start' },
  reasonLabel: { ...typography.caption, color: colors.brand.text, backgroundColor: colors.brand.page, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  title: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '700', minHeight: 40 },
  schedule: { ...typography.caption, color: colors.brand.text, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.brand.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  heart: { position: 'absolute', top: 2, right: 2, zIndex: 2 },
});
