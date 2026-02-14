import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppBackground, colors, radius, shadows, spacing, typography } from '@/components/ui/v2';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { EventResultCard } from '@/components/search/EventResultCard';
import { getCategoryLabel } from '@/constants/categories';
import type { EventWithCreator } from '@/types/database';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { supabase } from '@/lib/supabase/client';
import { EventsService } from '@/services/events.service';
import { useAuth } from '@/hooks';
import { SocialService } from '@/services/social.service';

type FavoriteRow = {
  event_id: string;
  created_at: string;
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { profile, session, isLoading } = useAuth();
  const { favorites, replaceFavorites, clearFavorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!session || !profile?.id) {
      replaceFavorites([]);
      setInitialLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('event_id, created_at')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const rows = (data || []) as FavoriteRow[];
      const ids = rows.map((row) => row.event_id).filter(Boolean);

      if (!ids.length) {
        replaceFavorites([]);
        return;
      }

      const events = await EventsService.getEventsByIds(ids);
      const byId = new Map(events.map((event) => [event.id, event]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as EventWithCreator[];
      replaceFavorites(ordered);
    } catch (error) {
      console.warn('load favorites error', error);
      Alert.alert('Erreur', 'Impossible de charger vos favoris pour le moment.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, replaceFavorites, session]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    favorites.forEach((event) => event.category && set.add(event.category));
    return Array.from(set);
  }, [favorites]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'all') return favorites;
    return favorites.filter((event) => event.category === selectedCategory);
  }, [favorites, selectedCategory]);

  const favoritesSet = useMemo(() => new Set(favorites.map((event) => event.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleToggleFavorite = async (event: EventWithCreator) => {
    if (!profile?.id) return;
    try {
      const nowFavorited = await SocialService.toggleFavorite(profile.id, event.id);
      const wasFavorited = favoritesSet.has(event.id);
      if (nowFavorited !== wasFavorited) {
        toggleFavorite(event);
      }
    } catch (error) {
      console.warn('favorites screen toggle favorite error', error);
      Alert.alert('Erreur', "Impossible d'enregistrer le favori pour le moment.");
    }
  };

  const handleToggleLike = async (event: EventWithCreator) => {
    if (!profile?.id) return;
    try {
      const nowLiked = await SocialService.like(profile.id, event.id);
      const wasLiked = likesSet.has(event.id);
      if (nowLiked !== wasLiked) {
        toggleLike(event.id);
      }
    } catch (error) {
      console.warn('favorites screen toggle like error', error);
      Alert.alert('Erreur', "Impossible d'enregistrer le like pour le moment.");
    }
  };

  const handleClearAll = async () => {
    if (!profile?.id) return;

    Alert.alert('Vider les favoris', 'Supprimer tous vos favoris ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('favorites').delete().eq('profile_id', profile.id);
            if (error) throw error;
            clearFavorites();
          } catch (clearError) {
            console.warn('clear favorites error', clearError);
            Alert.alert('Erreur', 'Impossible de vider les favoris pour le moment.');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <AppBackground opacity={0.2} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <AppBackground opacity={0.2} />
        <Text style={styles.emptyTitle}>Connexion requise</Text>
        <Text style={styles.emptySubtitle}>Connectez-vous pour accéder à vos favoris.</Text>
      </View>
    );
  }

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <AppBackground opacity={0.2} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground opacity={0.2} />
      <View style={styles.header}>
        <Text style={styles.title}>Mes favoris</Text>
        {favorites.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} accessibilityRole="button">
            <Text style={styles.clearText}>Vider</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {['all', ...categories].map((item) => (
          <TouchableOpacity
            key={item || 'all'}
            onPress={() => setSelectedCategory(item as string | 'all')}
            style={[styles.chip, selectedCategory === item && styles.chipActive]}
            accessibilityRole="button"
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptySubtitle}>Ajoutez des événements en favoris pour les retrouver ici.</Text>
          </View>
        }
        renderItem={({ item }: { item: EventWithCreator }) => (
          <EventResultCard
            event={item}
            onPress={() => router.push(`/events/${item.id}` as any)}
            onSelect={() => {}}
            onNavigate={() => setNavEvent(item)}
            onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
            isLiked={likesSet.has(item.id)}
            onToggleLike={handleToggleLike}
            isFavorite={favoritesSet.has(item.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      />

      <NavigationOptionsSheet visible={!!navEvent} event={navEvent} onClose={() => setNavEvent(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    backgroundColor: colors.background,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  clearText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceLevel1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.surfaceSoft,
  },
  emptyTitle: {
    ...typography.subsection,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
