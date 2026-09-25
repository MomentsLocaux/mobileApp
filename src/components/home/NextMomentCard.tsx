import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { colors, spacing, typography } from '@/constants/theme';
import type { EventWithCreator } from '@/types/database';
import { formatEventCardRangeLine, getEventCardCity } from '@/utils/event-card-meta';
import { HomeEventVisual } from './HomeEventVisual';

type Props = { event: EventWithCreator; distanceLabel?: string | null; onPress: () => void; onOpenAgenda: () => void };
export function NextMomentCard({ event, distanceLabel, onPress, onOpenAgenda }: Props) {
  return <View style={styles.card}>
    <View style={styles.header}>
      <Text style={styles.kicker}>Ton prochain moment</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir l’agenda à la date de ce moment" onPress={onOpenAgenda} style={styles.agenda}>
        <BrandIcon name="calendar" size={18} /><Text style={styles.agendaLabel}>Agenda</Text>
      </Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ton prochain moment, ${event.title}`} onPress={onPress} style={styles.row}>
      <HomeEventVisual event={event} style={styles.cover} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.meta} numberOfLines={2}>{formatEventCardRangeLine(event, 'compact')}</Text>
        <Text style={styles.meta} numberOfLines={1}>{[event.venue_name || getEventCardCity(event), distanceLabel].filter(Boolean).join(' · ')}</Text>
      </View>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, paddingHorizontal: 12, paddingBottom: 12, borderRadius: 20, backgroundColor: colors.brand.surface, borderWidth: 1, borderColor: colors.primary[200] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  kicker: { ...typography.caption, fontWeight: '700', color: colors.brand.text, flexShrink: 1 },
  agenda: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  agendaLabel: { ...typography.caption, fontWeight: '700', color: colors.brand.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 64, height: 64 },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.bodySmall, color: colors.brand.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.brand.textSecondary },
});
