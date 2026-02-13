import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ShoppingBag, Sparkles, Coins } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import { AppBackground, Card } from '@/components/ui';

type ShopItem = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  type: string;
};

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShopItem[]>([]);

  const loadItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('shop_items')
        .select('id, title, description, price, type')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems((data || []) as ShopItem[]);
    } catch (error) {
      console.warn('load shop items error', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppBackground />
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <ShoppingBag size={20} color={colors.primary[600]} />
        </View>
        <View>
          <Text style={styles.title}>Boutique</Text>
          <Text style={styles.subtitle}>Objets disponibles</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : items.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucun article</Text>
          <Text style={styles.emptyBody}>La boutique sera alimentée bientôt.</Text>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemTypeWrap}>
                <Sparkles size={14} color={colors.secondary[600]} />
                <Text style={styles.itemType}>{item.type}</Text>
              </View>
              <View style={styles.priceWrap}>
                <Coins size={14} color={colors.warning[600]} />
                <Text style={styles.priceText}>{item.price}</Text>
              </View>
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemDescription}>{item.description || 'Aucune description.'}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: '100%',
    padding: spacing.lg,
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
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyCard: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.h5,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  emptyBody: {
    ...typography.body,
    color: colors.neutral[600],
  },
  itemCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTypeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemType: {
    ...typography.caption,
    color: colors.secondary[700],
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceText: {
    ...typography.bodySmall,
    color: colors.warning[700],
    fontWeight: '700',
  },
  itemTitle: {
    ...typography.bodyLarge,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  itemDescription: {
    ...typography.body,
    color: colors.neutral[600],
  },
});
