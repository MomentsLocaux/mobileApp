import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Target, Trophy, CheckCircle } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { AppBackground } from '@/components/ui';

export default function MissionsScreen() {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Target size={20} color={colors.brand.primary} />
          </View>
          <View>
            <Text style={styles.title}>Missions & XP</Text>
            <Text style={styles.subtitle}>Progresse et gagne du Lumo</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Trophy size={18} color={colors.brand.secondary} />
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
            <CheckCircle size={18} color={colors.brand.primary} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.brand.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  card: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: colors.brand.text,
  },
  cardText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ctaText: {
    ...typography.body,
    color: colors.brand.text,
    fontWeight: '700',
  },
  ctaSecondary: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: 'transparent',
  },
  ctaSecondaryText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '700',
  },
});
