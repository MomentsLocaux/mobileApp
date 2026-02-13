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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks';
import { useLocationStore, useSearchStore } from '@/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { SocialService } from '@/services/social.service';
import { filterEvents, filterEventsByMetaStatus, type EventMetaFilter } from '@/utils/filter-events';
import { sortEvents } from '@/utils/sort-events';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { EventResultCard } from '@/components/search/EventResultCard';
import type { EventWithCreator } from '@/types/database';
import { CommunityService } from '@/services/community.service';
import { SearchBar } from '@/components/search/SearchBar';
import { buildFiltersFromSearch } from '@/utils/search-filters';
import { EventsService } from '@/services/events.service';
import { TriageControl } from '@/components/search/TriageControl';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { AppBackground } from '@/components/ui';

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
  const { likedEventIds, toggleLike } = useLikesStore();
  const searchState = useSearchStore();
  const { events: fetchedEvents, loading: loadingEvents, reload } = useEvents({ limit: 100 });
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [searchApplied, setSearchApplied] = useState(false);
  const [searchResults, setSearchResults] = useState<EventWithCreator[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [metaFilter, setMetaFilter] = useState<EventMetaFilter>('all');
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const insets = useSafeAreaInsets();

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const filters = useMemo(() => buildFiltersFromSearch(searchState, userLocation), [searchState, userLocation]);
  const sortBy = searchState.sortBy || 'triage';
  const sortOrder = searchState.sortOrder;
  const hasSearchCriteria = useMemo(() => {
    const hasWhere = !!searchState.where.location || !!searchState.where.radiusKm;
    const hasWhen =
      !!searchState.when.preset ||
      !!searchState.when.startDate ||
      !!searchState.when.endDate ||
      !!searchState.when.includePast;
    const hasWhat =
      searchState.what.categories.length > 0 ||
      searchState.what.subcategories.length > 0 ||
      searchState.what.tags.length > 0 ||
      !!searchState.what.query?.trim();
    return hasWhere || hasWhen || hasWhat;
  }, [
    searchState.where.location,
    searchState.where.radiusKm,
    searchState.when.preset,
    searchState.when.startDate,
    searchState.when.endDate,
    searchState.when.includePast,
    searchState.what.categories,
    searchState.what.subcategories,
    searchState.what.tags,
    searchState.what.query,
  ]);
  const filteredAndSortedEvents = useMemo(() => {
    const base = searchApplied ? searchResults : fetchedEvents || [];
    const metaFiltered = filterEventsByMetaStatus(base, metaFilter);
    return sortEvents(metaFiltered, sortBy, userLocation, sortOrder);
  }, [fetchedEvents, metaFilter, searchApplied, searchResults, sortBy, sortOrder, userLocation]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
    }
  }, [hasSearchCriteria, searchApplied]);

  const effectiveRadiusKm = useMemo(() => {
    if (searchState.where.radiusKm !== undefined) {
      return searchState.where.radiusKm > 0 ? searchState.where.radiusKm : 10;
    }
    if (searchState.where.location) return 10;
    return undefined;
  }, [searchState.where.location, searchState.where.radiusKm]);

  const searchCenter = useMemo(() => {
    if (searchState.where.location) {
      return { latitude: searchState.where.location.latitude, longitude: searchState.where.location.longitude };
    }
    if (searchState.where.radiusKm && userLocation) {
      return userLocation;
    }
    return null;
  }, [searchState.where.location, searchState.where.radiusKm, userLocation]);

  useEffect(() => {
    let cancelled = false;
    if (metaFilter !== 'all') {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (!searchApplied || !hasSearchCriteria) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const run = async () => {
      try {
        let baseEvents: EventWithCreator[] = [];
        if (searchCenter && effectiveRadiusKm) {
          const latDelta = effectiveRadiusKm / 111;
          const lonDelta =
            effectiveRadiusKm /
            (111 * Math.max(Math.cos((searchCenter.latitude * Math.PI) / 180), 0.1));
          const ne: [number, number] = [searchCenter.longitude + lonDelta, searchCenter.latitude + latDelta];
          const sw: [number, number] = [searchCenter.longitude - lonDelta, searchCenter.latitude - latDelta];

          const featureCollection = await EventsService.listEventsByBBox({
            ne,
            sw,
            limit: 300,
            includePast: !!searchState.when.includePast,
          });
          const ids =
            featureCollection?.features
              ?.map((f: any) => f?.properties?.id)
              .filter(Boolean) || [];
          const uniqueIds = Array.from(new Set(ids)) as string[];
          baseEvents = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
        } else {
          baseEvents = await EventsService.listEvents({ limit: 300, includePast: !!searchState.when.includePast });
        }

        const filtered = filterEvents(baseEvents, filters, null);
        if (!cancelled) {
          setSearchResults(filtered);
        }
      } catch (e) {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveRadiusKm, filters, hasSearchCriteria, metaFilter, searchApplied, searchCenter, searchState.when.includePast]);

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
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleToggleLike = async (event: EventWithCreator) => {
    try {
      const nowLiked = await SocialService.like(profile?.id || '', event.id);
      const wasLiked = likesSet.has(event.id);
      if (nowLiked !== wasLiked) {
        toggleLike(event.id);
      }
    } catch (e) {
      console.warn('toggle like error', e);
    }
  };

  const handleToggleFavorite = async (event: EventWithCreator) => {
    try {
      const nowFavorited = await SocialService.toggleFavorite(profile?.id || '', event.id);
      const wasFavorited = favoritesSet.has(event.id);
      if (nowFavorited !== wasFavorited) {
        toggleFavorite(event);
      }
    } catch (e) {
      console.warn('toggle favorite error', e);
    }
  };

  if (loadingEvents) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Chargement des événements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground />
      <View style={[styles.topOverlay, { marginTop: insets.top + spacing.xs }]}>
        <SearchBar
          onApply={() => {
            setMetaFilter('all');
            setSearchApplied(true);
          }}
          hasLocation={!!userLocation}
          applied={searchApplied}
          enableCommunitySearch
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pour vous</Text>
        <TriageControl
          value={sortBy}
          onChange={(value) => searchState.setSortBy(value)}
          sortOrder={sortOrder}
          onSortOrderChange={(order) => searchState.setSortOrder(order)}
          hasLocation={!!userLocation}
        />
      </View>
      <View style={styles.metaFilterRow}>
        {([
          { key: 'all', label: 'Tous' },
          { key: 'live', label: 'En cours' },
          { key: 'upcoming', label: 'À venir' },
          { key: 'past', label: 'Passés' },
        ] as const).map((item) => {
          const active = metaFilter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.metaFilterPill, active && styles.metaFilterPillActive]}
              onPress={() => {
                setMetaFilter(item.key);
                if (item.key !== 'all') {
                  setSearchApplied(false);
                }
              }}
            >
              <Text style={[styles.metaFilterText, active && styles.metaFilterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

      <FlatList
        data={filteredAndSortedEvents}
        nestedScrollEnabled
        renderItem={({ item }: { item: EventWithCreator }) => (
          <EventResultCard
            event={item}
            showCarousel={false}
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[600]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchLoading ? 'Recherche en cours...' : 'Aucun événement trouvé'}
            </Text>
          </View>
        }
      />

      <NavigationOptionsSheet
        visible={!!navEvent}
        event={navEvent}
        onClose={() => setNavEvent(null)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[900],
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaFilterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  metaFilterPillActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  metaFilterText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  metaFilterTextActive: {
    color: colors.primary[700],
  },
  carouselContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  storiesContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
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
  topOverlay: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    maxWidth: 400,
    zIndex: 10,
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
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
