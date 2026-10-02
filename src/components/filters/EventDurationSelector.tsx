import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilterChipRow } from './FilterChipRow';
import { colors, typography } from '@/constants/theme';
import type { EventDurationBucket } from '@/types/filters';
import { normalizeDurationSelection } from '@/utils/event-duration';

export const EVENT_DURATION_OPTIONS: { key: EventDurationBucket; label: string; caption: string }[] = [
  { key: 'exceptional', label: 'Exceptionnel', caption: '1 à 3 jours' },
  { key: 'short', label: 'Court', caption: '4 à 14 j' },
  { key: 'long', label: 'Long', caption: '15 jours et +' },
];

export function EventDurationSelector({ values, onChange, testID }: {
  values: EventDurationBucket[];
  onChange: (values: EventDurationBucket[]) => void;
  testID: string;
}) {
  return <View style={styles.section}>
    <Text style={styles.title}>Sur combien de jours ?</Text>
    <Text style={styles.hint}>La durée totale de l’événement. Sans sélection, toutes les durées sont incluses.</Text>
    <FilterChipRow mode="multi" options={EVENT_DURATION_OPTIONS} values={values}
      onChange={next => onChange(normalizeDurationSelection(next))} scrollable={false} size="md"
      testID={testID} accessibilityLabel="Durée des événements, plusieurs choix possibles" />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  title: { ...typography.body, fontWeight: '700', color: colors.brand.text },
  hint: { ...typography.bodySmall, color: colors.brand.textSecondary },
});
