import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Target, Trophy, CheckCircle } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function MissionsScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Target size={20} color={colors.primary[600]} />
        </View>
        <View>
          <Text style={styles.title}>Missions & XP</Text>
          <Text style={styles.subtitle}>Progresse et gagne du Lumo</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Trophy size={18} color={colors.secondary[600]} />
          <Text style={styles.cardTitle}>Missions quotidiennes</Text>
        </View>
        <Text style={styles.cardText}>
          Valide tes missions pour obtenir XP et Lumo. À synchroniser avec la vue Supabase mission_progress_view.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/missions' as any)}>
          <Text style={styles.ctaText}>Voir mes missions</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <CheckCircle size={18} color={colors.primary[600]} />
          <Text style={styles.cardTitle}>Check-in & Récompenses</Text>
        </View>
        <Text style={styles.cardText}>
          Les check-ins crédite du Lumo si valides (edge function). Ajoute l’écran dédié via /api/events/:id/checkin.
        </Text>
        <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/(tabs)/map' as any)}>
          <Text style={styles.ctaSecondaryText}>Aller sur la carte</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  cardText: {
    ...typography.body,
    color: colors.neutral[600],
  },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ctaText: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  ctaSecondary: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  ctaSecondaryText: {
    ...typography.body,
    color: colors.primary[700],
    fontWeight: '700',
  },
});
