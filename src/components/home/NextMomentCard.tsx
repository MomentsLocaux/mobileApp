import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { colors, spacing, typography } from '@/constants/theme';
import type { EventWithCreator } from '@/types/database';
import { HomeEventCard } from './HomeEventCard';

type Props = {
  event: EventWithCreator;
  distanceLabel?: string | null;
  hearted: boolean;
  pending?: boolean;
  onPress: () => void;
  onToggleHeart: () => void;
  onOpenAgenda: () => void;
};

export function NextMomentCard({ event, distanceLabel, hearted, pending, onPress, onToggleHeart, onOpenAgenda }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Ton prochain moment</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir l’agenda à la date de ce moment" onPress={onOpenAgenda} style={styles.agenda}>
          <BrandIcon name="calendar" size={18} /><Text style={styles.agendaLabel}>Agenda</Text>
        </Pressable>
      </View>
      <HomeEventCard
        event={event}
        distanceLabel={distanceLabel}
        hearted={hearted}
        pending={pending}
        onPress={onPress}
        onToggleHeart={onToggleHeart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, paddingTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: spacing.sm },
  kicker: { ...typography.caption, fontWeight: '700', color: colors.brand.text, flexShrink: 1 },
  agenda: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  agendaLabel: { ...typography.caption, fontWeight: '700', color: colors.brand.text },
});
