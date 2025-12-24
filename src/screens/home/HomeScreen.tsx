import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks';
import { useFilterStore, useLocationStore } from '@/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { SocialService } from '@/services/social.service';
import { filterEvents } from '@/utils/filter-events';
import { sortEvents } from '@/utils/sort-events';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { EventFilters } from '@/components/events';
import { EventResultCard } from '@/components/search/EventResultCard';
import type { EventWithCreator } from '@/types/database';
import { CommunityService } from '@/services/community.service';

type StoryItem = {
  creatorId: string;
  name: string;
  avatar?: string | null;
  cover?: string | null;
  lastEventDate: Date;
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentLocation } = useLocationStore();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { filters, focusedIds, setFilters, resetFilters, getActiveFilterCount } = useFilterStore();
  const { events: fetchedEvents, loading: loadingEvents, reload } = useEvents({ limit: 100 });
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState<StoryItem[]>([]);

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const filteredAndSortedEvents = useMemo(() => {
    const base = filterEvents(fetchedEvents || [], filters, focusedIds);
    return sortEvents(base, filters.sortBy || 'date', userLocation);
  }, [fetchedEvents, filters, focusedIds, userLocation]);

  const handleRefresh = () => {
    setRefreshing(true);
    reload();
    setRefreshing(false);
  };

  const buildStories = useCallback(
    async (events: EventWithCreator[]) => {
      const currentUserId = profile?.id;
      if (!currentUserId) {
        setStories([]);
        return;
      }
      const followingIds = await CommunityService.getFollowingIds(currentUserId);
      if (!followingIds.length) {
        setStories([]);
        return;
      }
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const sorted = [...events]
        .filter((e) => {
          if (!followingIds.includes(e.creator_id)) return false;
          const created = e.created_at ? new Date(e.created_at) : null;
          if (created && created < sevenDaysAgo) return false;
          return true;
        })
        .sort((a, b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        });

      const byCreator = new Map<string, StoryItem>();
      sorted.forEach((e) => {
        if (byCreator.has(e.creator_id)) return;
        const createdAt = e.created_at ? new Date(e.created_at) : new Date();
        byCreator.set(e.creator_id, {
          creatorId: e.creator_id,
          name: e.creator?.display_name || 'Créateur',
          avatar: e.creator?.avatar_url || null,
          cover: e.creator?.cover_url || e.cover_url || null,
          lastEventDate: createdAt,
        });
      });
      setStories(Array.from(byCreator.values()));
    },
    [profile?.id]
  );

  useEffect(() => {
    if (fetchedEvents) {
      buildStories(fetchedEvents);
    }
  }, [fetchedEvents, buildStories]);

  const favoritesSet = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const handleToggleFavorite = async (event: EventWithCreator) => {
    try {
      await SocialService.toggleFavorite(profile?.id || '', event.id);
      toggleFavorite(event);
    } catch (e) {
      console.warn('toggle favorite error', e);
    }
  };

  if (loadingEvents) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Chargement des événements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Pour vous</Text>
      <FlatList
        horizontal
        data={[{ me: true }, ...stories]}
        keyExtractor={(item: any, index) => (item.me ? 'me' : item.creatorId || String(index))}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContent}
        renderItem={({ item }: any) =>
          item.me ? (
            <TouchableOpacity style={styles.storyItem} onPress={() => router.push('/events/create/step-1' as any)}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.storyAvatar} />
              ) : (
                <View style={[styles.storyAvatar, styles.storyPlaceholder]} />
              )}
              <View style={styles.plusBadge}>
                <Text style={styles.plusText}>+</Text>
              </View>
              <Text style={styles.storyLabel} numberOfLines={1}>
                Nouveau
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.storyItem}
              onPress={() => router.push(`/community/${item.creatorId}` as any)}
            >
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
              ) : (
                <View style={[styles.storyAvatar, styles.storyPlaceholder]} />
              )}
              <Text style={styles.storyLabel} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )
        }
      />

      <View style={styles.filtersRow}>
        <EventFilters
          filters={filters}
          onFiltersChange={setFilters}
          onReset={() => {
            resetFilters();
          }}
          activeFiltersCount={getActiveFilterCount()}
        />
      </View>

      <FlatList
        data={filteredAndSortedEvents}
        renderItem={({ item }: { item: EventWithCreator }) => (
          <EventResultCard
            event={item}
            onPress={() => router.push(`/events/${item.id}` as any)}
            onSelect={() => {}}
            onNavigate={() => router.push(`/events/${item.id}` as any)}
            onOpenCreator={(creatorId) => router.push(`/community/${creatorId}` as any)}
            isFavorite={favoritesSet.has(item.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[600]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun événement trouvé</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[900],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  carouselContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  storiesContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  storyItem: {
    width: 68,
    position: 'relative',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.primary[600],
  },
  storyPlaceholder: {
    backgroundColor: colors.neutral[300],
  },
  storyLabel: {
    ...typography.caption,
    color: colors.neutral[700],
    marginTop: 4,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 20,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.neutral[0],
  },
  plusText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  carouselCard: {
    width: 200,
    height: 220,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.neutral[200],
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPlaceholder: {
    backgroundColor: colors.neutral[200],
  },
  carouselOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  carouselTitle: {
    ...typography.body,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  carouselMeta: {
    ...typography.caption,
    color: colors.neutral[0],
  },
  filtersRow: {
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.neutral[600],
  },
});
