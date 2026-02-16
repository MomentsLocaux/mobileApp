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
    <View style={styles.wrapper}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <ShoppingBag size={20} color={colors.brand.primary} />
          </View>
          <View>
            <Text style={styles.title}>Boutique</Text>
            <Text style={styles.subtitle}>Objets disponibles</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
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
                  <Sparkles size={14} color={colors.brand.secondary} />
                  <Text style={styles.itemType}>{item.type}</Text>
                </View>
                <View style={styles.priceWrap}>
                  <Coins size={14} color={colors.brand.secondary} />
                  <Text style={styles.priceText}>{item.price}</Text>
                </View>
              </View>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDescription}>{item.description || 'Aucune description.'}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
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
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  wrapper: {
    flex: 1,
  },
  emptyCard: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.brand.surface,
  },
  emptyTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
  },
  emptyBody: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  itemCard: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.brand.surface,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: colors.brand.secondary,
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
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  itemTitle: {
    ...typography.bodyLarge,
    color: colors.brand.text,
    fontWeight: '700',
  },
  itemDescription: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
});
