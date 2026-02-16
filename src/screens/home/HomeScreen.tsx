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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell } from 'lucide-react-native';
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
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';

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
  const [eventCardStatsById, setEventCardStatsById] = useState<Record<string, EventCardStats>>({});
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
  const filteredEventIds = useMemo(
    () => filteredAndSortedEvents.map((event) => event.id).filter(Boolean),
    [filteredAndSortedEvents],
  );
  const filteredEventIdsKey = useMemo(() => filteredEventIds.join(','), [filteredEventIds]);

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

  useEffect(() => {
    let cancelled = false;
    if (!filteredEventIds.length) {
      setEventCardStatsById({});
      return;
    }

    const loadStats = async () => {
      try {
        const stats = await EventCardStatsService.getStatsForEvents(filteredEventIds, profile?.id);
        if (!cancelled) {
          setEventCardStatsById(stats);
        }
      } catch {
        if (!cancelled) {
          setEventCardStatsById({});
        }
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [filteredEventIds, filteredEventIdsKey, profile?.id]);

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
        <ActivityIndicator size="large" color={colors.brand.secondary} />
        <Text style={styles.loadingText}>Chargement des événements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* AppBackground is now global in _layout.tsx */}
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
            <View style={styles.headerAvatarContainer}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: colors.brand.secondary }]} />
              )}
              <View style={styles.headerAvatarIcon}>
                <Image source={require('../../../assets/images/icon.png')} style={{ width: 12, height: 12 }} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerSubtitle}>Salut, {profile?.display_name?.split(' ')[0] || 'Alex'} 👋</Text>
            <Text style={styles.headerTitle}>Moments Locaux</Text>
          </View>

          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => router.push('/notifications' as any)}
          >
            <Bell size={20} color={colors.brand.secondary} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <SearchBar
            onApply={() => {
              setMetaFilter('all');
              setSearchApplied(true);
            }}
            hasLocation={!!userLocation}
            applied={searchApplied}
            enableCommunitySearch
            placeholder="Rechercher des événements..."
          />
        </View>
      </View>

      {/* Stories / Creators */}
      <View style={styles.storiesContainer}>
        <View style={styles.storiesHeader}>
          <Text style={styles.sectionTitle}>En ce moment</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/community' as any)}>
            <Text style={styles.seeAllText}>Tout voir</Text>
          </TouchableOpacity>
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
                <LinearGradient
                  colors={['#2bbfe3', '#2bbfe3']}
                  style={styles.storyGradientBorder}
                >
                  <View style={styles.storyInner}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.storyAvatar} />
                    ) : (
                      <View style={[styles.storyAvatar, styles.storyPlaceholder]} />
                    )}
                    <View style={styles.plusBadge}>
                      <Text style={styles.plusText}>+</Text>
                    </View>
                  </View>
                </LinearGradient>
                <Text style={[styles.storyLabel, styles.storyLabelActive]} numberOfLines={1}>
                  Live
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.storyItem}
                onPress={() => router.push(`/community/${item.creatorId}` as any)}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#2bbfe3']} // Purple to Cyan gradient
                  style={styles.storyGradientBorder}
                >
                  <View style={styles.storyInner}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
                    ) : (
                      <View style={[styles.storyAvatar, styles.storyPlaceholder]} />
                    )}
                  </View>
                </LinearGradient>
                <Text style={styles.storyLabel} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )
          }
        />
      </View>

      {/* Filters */}
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

      <FlatList
        data={filteredAndSortedEvents}
        nestedScrollEnabled
        renderItem={({ item }: { item: EventWithCreator }) => (
          <EventResultCard
            event={item}
            viewsCount={eventCardStatsById[item.id]?.viewsCount ?? 0}
            friendsGoingCount={eventCardStatsById[item.id]?.friendsGoingCount ?? 0}
            showCarousel={false}
            onPress={() => router.push(`/events/${item.id}` as any)}
            onSelect={() => { }}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.secondary} />}
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
    // backgroundColor: colors.brand.primary, // Removed to allow AppBackground to show
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
  },
  loadingText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    // backgroundColor: colors.brand.primary, // Removed for uniformity
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerAvatarIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.brand.primary,
    borderRadius: 8,
    padding: 2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.h4,
    color: colors.brand.text,
    lineHeight: 24,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.secondary,
    borderWidth: 1,
    borderColor: colors.brand.surface,
  },
  searchContainer: {
    marginTop: spacing.xs,
  },
  storiesContainer: {
    paddingBottom: spacing.md,
  },
  storiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.brand.text,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '600',
  },
  storiesContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  storyGradientBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  storyInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.primary, // Create a gap effect
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: colors.brand.surface,
  },
  storyPlaceholder: {
    backgroundColor: colors.brand.surface,
  },
  storyLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  storyLabelActive: {
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  plusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.brand.text,
  },
  // Section Header for "Pour vous" (reused style, can adjust if needed)
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  metaFilterPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metaFilterPillActive: {
    backgroundColor: colors.brand.secondary,
    borderColor: colors.brand.secondary,
  },
  metaFilterText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
  metaFilterTextActive: {
    color: '#0f1719', // Dark text on active cyan pill
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  // Legacy styles kept just in case, but they seem unused now:
  // storyAvatarContainer, storyAvatarMe
});
