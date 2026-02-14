import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Target, Trophy, CheckCircle } from 'lucide-react-native';
import { AppBackground, Button, Card, colors, radius, spacing, typography } from '@/components/ui/v2';

export default function MissionsScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <AppBackground opacity={0.2} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Target size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Missions & XP</Text>
            <Text style={styles.subtitle}>Progresse et gagne du Lumo</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Trophy size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Missions quotidiennes</Text>
          </View>
          <Text style={styles.cardText}>
            Valide tes missions pour obtenir XP et Lumo. À synchroniser avec la vue Supabase mission_progress_view.
          </Text>
          <Button title="Voir mes missions" onPress={() => router.push('/missions' as any)} />
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <CheckCircle size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Check-in & Récompenses</Text>
          </View>
          <Text style={styles.cardText}>
            Les check-ins créditent du Lumo si valides (edge function). Ajoute l’écran dédié via /api/events/:id/checkin.
          </Text>
          <Button
            title="Aller sur la carte"
            variant="secondary"
            onPress={() => router.push('/(tabs)/map' as any)}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(43, 191, 227, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyStrong,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
