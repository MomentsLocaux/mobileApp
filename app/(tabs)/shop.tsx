import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ShoppingBag, Sparkles, Coins } from 'lucide-react-native';
import { AppBackground, Card, colors, radius, spacing, typography } from '@/components/ui/v2';
import { supabase } from '@/lib/supabase/client';

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
    <View style={styles.screen}>
      <AppBackground opacity={0.2} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <ShoppingBag size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>Boutique</Text>
            <Text style={styles.subtitle}>Objets disponibles</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
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
                  <Sparkles size={14} color={colors.primary} />
                  <Text style={styles.itemType}>{item.type}</Text>
                </View>
                <View style={styles.priceWrap}>
                  <Coins size={14} color={colors.success} />
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
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    minHeight: '100%',
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
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyCard: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
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
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceText: {
    ...typography.bodyStrong,
    color: colors.success,
    fontWeight: '700',
  },
  itemTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  itemDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
