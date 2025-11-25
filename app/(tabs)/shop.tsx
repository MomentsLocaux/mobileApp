import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ShoppingBag, Sparkles } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function ShopScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <ShoppingBag size={20} color={colors.primary[600]} />
        </View>
        <View>
          <Text style={styles.title}>Boutique</Text>
          <Text style={styles.subtitle}>Achète avec Lumo ou €</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Sparkles size={18} color={colors.secondary[600]} />
          <Text style={styles.cardTitle}>Catalogue</Text>
        </View>
        <Text style={styles.cardText}>
          Connecte le module à Supabase: table shop_items (type, prix lumo/eur) et endpoint /api/shop/purchase.
          Filtre par type et affiche l’inventaire dans le profil.
        </Text>
        <TouchableOpacity style={styles.cta}>
          <Text style={styles.ctaText}>À implémenter</Text>
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
});
