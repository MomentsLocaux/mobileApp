import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AppBackground, ScreenHeader } from '@/components/ui';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';
import { colors, spacing, typography } from '@/constants/theme';

const EARN_ROWS: { title: string; detail: string }[] = [
  {
    title: 'Check-in sur place',
    detail: '+20 Lumo par événement (1 fois).',
  },
  {
    title: 'Mission du jour',
    detail: '+12 Lumo quand tu complètes la mission daily.',
  },
  {
    title: 'Mission de la semaine',
    detail: '+60 Lumo pour la mission weekly.',
  },
  {
    title: 'Événement tenu (créateurs)',
    detail:
      'Après la fin de l’événement, s’il reste publié : de +20 à +150 Lumo selon la durée (<2h → 20 · 2–4h → 35 · 4–8h → 50 · 8–24h → 70 · 1–3j → 90 · 3–7j → 120 · >7j → 150). Max 2 crédits / semaine. Annulé ou archivé avant la fin = 0 Lumo.',
  },
  {
    title: 'Pass quartier',
    detail: 'Bientôt — récompenses partenaires IRL (pas encore actif).',
  },
];

const SPEND_ROWS: { title: string; detail: string }[] = [
  {
    title: 'Boost événement 24h',
    detail: 'Mets ton événement en avant sur la carte et les listes.',
  },
  {
    title: 'Early access',
    detail: 'Débloque ou ouvre une fenêtre d’accès anticipé (selon règles).',
  },
  {
    title: 'Boutique',
    detail: 'Articles disponibles sous l’onglet Boutique.',
  },
];

export default function LumoEarnScreen() {
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)/map" />;
  }

  return <LumoEarnScreenInner />;
}

function LumoEarnScreenInner() {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScreenHeader title="Comment gagner des Lumo" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>
          Les Lumo récompensent l’activité réelle dans ton quartier. Ce n’est pas de l’argent et
          ce n’est pas convertible en euros.
        </Text>

        <Text style={styles.sectionTitle}>Gagner</Text>
        {EARN_ROWS.map((row) => (
          <View key={row.title} style={styles.row}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowDetail}>{row.detail}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Utiliser</Text>
        {SPEND_ROWS.map((row) => (
          <View key={row.title} style={styles.row}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowDetail}>{row.detail}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  intro: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.brand.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  rowTitle: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  rowDetail: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
});
