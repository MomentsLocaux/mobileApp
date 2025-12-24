import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../src/constants/theme';
import { useFavoritesStore } from '@/store/favoritesStore';
import { EventResultCard } from '@/components/search/EventResultCard';
import { getCategoryLabel } from '@/constants/categories';
import type { EventWithCreator } from '@/types/database';
import { useRouter } from 'expo-router';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, clearFavorites } = useFavoritesStore();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    favorites.forEach((e) => e.category && set.add(e.category));
    return Array.from(set);
  }, [favorites]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'all') return favorites;
    return favorites.filter((e) => e.category === selectedCategory);
  }, [favorites, selectedCategory]);

  const handleRefresh = () => {
    // Pas de reload distant pour les favoris persistés localement, on “simule”.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes favoris</Text>
        {favorites.length > 0 && (
          <TouchableOpacity onPress={clearFavorites}>
            <Text style={styles.clearText}>Vider</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {['all', ...categories].map((item) => (
          <TouchableOpacity
            key={item || 'all'}
            onPress={() => setSelectedCategory(item as any)}
            style={[
              styles.chip,
              selectedCategory === item && styles.chipActive,
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, selectedCategory === item && styles.chipTextActive]}>
              {item === 'all' ? 'Toutes' : getCategoryLabel(item)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[600]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptySubtitle}>Ajoute des événements à tes favoris pour les retrouver ici.</Text>
          </View>
        }
        renderItem={({ item }: { item: EventWithCreator }) => (
          <EventResultCard
            event={item}
            onPress={() => router.push(`/events/${item.id}` as any)}
            onSelect={() => {}}
            onNavigate={() => router.push(`/events/${item.id}` as any)}
            onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.neutral[900],
    fontWeight: '700',
  },
  clearText: {
    ...typography.caption,
    color: colors.error[600],
    fontWeight: '700',
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[200],
    alignSelf: 'flex-start',
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  chipText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary[700],
  },
  listContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.h5,
    color: colors.neutral[800],
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
