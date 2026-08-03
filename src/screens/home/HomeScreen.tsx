import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useLocationStore, useSearchStore } from '@/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { filterEvents, filterEventsByMetaStatus, type EventMetaFilter } from '@/utils/filter-events';
import { syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { sortEvents } from '@/utils/sort-events';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { EventResultCard } from '@/components/search/EventResultCard';
import { MapResultCard } from '@/components/search/MapResultCard';
import type { EventWithCreator } from '@/types/database';
import { SearchBar } from '@/components/search/SearchBar';
import { buildFiltersFromSearch } from '@/utils/search-filters';
import { EventsService } from '@/services/events.service';
import { NotificationsService } from '@/services/notifications.service';
import { TriageControl } from '@/components/search/TriageControl';
import {
  DEFAULT_SEARCH_RADIUS_KM,
  hasSearchCriteria as checkSearchCriteria,
  resolveEffectiveRadiusKm,
  resolveSearchCenter,
  SEARCH_FETCH_LIMIT,
} from '@/utils/search-helpers';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { listEventsByBBoxForMap } from '@/utils/bbox-event-fetch';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { AppBackground, EmptyState, EventCardSkeleton } from '@/components/ui';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';

const NEARBY_CAROUSEL_LIMIT = 12;
const META_FILTER_OPTIONS = [
  { key: 'all', label: 'Tous' },
  { key: 'live', label: 'En cours' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passés' },
] as const;

type HomeFeedEventItemProps = {
  event: EventWithCreator;
  viewsCount: number;
  friendsGoingCount: number;
  isHearted: boolean;
  onPressEvent: (eventId: string) => void;
  onNavigateEvent: (event: EventWithCreator) => void;
  onToggleHeart: (event: EventWithCreator) => void;
};

const HomeFeedEventItem = React.memo(function HomeFeedEventItem({
  event,
  viewsCount,
  friendsGoingCount,
  isHearted,
  onPressEvent,
  onNavigateEvent,
  onToggleHeart,
}: HomeFeedEventItemProps) {
  const onPress = useCallback(() => onPressEvent(event.id), [event.id, onPressEvent]);
  const onNavigate = useCallback(() => onNavigateEvent(event), [event, onNavigateEvent]);

  return (
    <EventResultCard
      event={event}
      viewsCount={viewsCount}
      friendsGoingCount={friendsGoingCount}
      showCarousel={false}
      variant="discovery"
      onPress={onPress}
      onNavigate={onNavigate}
      isHearted={isHearted}
      onToggleHeart={onToggleHeart}
    />
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { canCreateNow, accent } = useAccountIdentity();
  const { currentLocation } = useLocationStore();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const searchState = useSearchStore();
  const { events: fetchedEvents, loading: loadingEvents, reload } = useEvents({ limit: 100 });
  const [refreshing, setRefreshing] = useState(false);
  const searchApplied = searchState.searchApplied;
  const setSearchApplied = searchState.setSearchApplied;
  const [searchResults, setSearchResults] = useState<EventWithCreator[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [metaFilter, setMetaFilter] = useState<EventMetaFilter>('all');
  const [metaFeedEvents, setMetaFeedEvents] = useState<EventWithCreator[]>([]);
  const [metaFeedLoading, setMetaFeedLoading] = useState(false);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [eventCardStatsById, setEventCardStatsById] = useState<Record<string, EventCardStats>>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const insets = useSafeAreaInsets();

  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Salut, ${firstName} 👋` : 'Salut 👋';

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
  const hasSearchCriteria = useMemo(() => checkSearchCriteria(searchState), [searchState]);
  const showSearchResults = searchApplied && metaFilter === 'all';

  const filteredAndSortedEvents = useMemo(() => {
    const base = showSearchResults ? searchResults : metaFeedEvents;
    const metaFiltered = filterEventsByMetaStatus(base, metaFilter);
    return sortEvents(metaFiltered, sortBy, userLocation, sortOrder);
  }, [metaFeedEvents, metaFilter, searchResults, showSearchResults, sortBy, sortOrder, userLocation]);

  /** Nearby carousel: live + upcoming within default radius, distance ASC — independent of temporal chips. */
  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];
    const live = filterEventsByMetaStatus(fetchedEvents, 'live');
    const upcoming = filterEventsByMetaStatus(fetchedEvents, 'upcoming');
    const byId = new Map<string, EventWithCreator>();
    for (const event of [...live, ...upcoming]) {
      byId.set(event.id, event);
    }
    const withinRadius = filterEvents([...byId.values()], {
      centerLat: userLocation.latitude,
      centerLon: userLocation.longitude,
      radiusKm: DEFAULT_SEARCH_RADIUS_KM,
      includePast: false,
    });
    return sortEvents(withinRadius, 'distance', userLocation).slice(0, NEARBY_CAROUSEL_LIMIT);
  }, [fetchedEvents, userLocation]);

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

  const effectiveRadiusKm = useMemo(
    () => resolveEffectiveRadiusKm(searchState.where, userLocation),
    [searchState.where, userLocation]
  );

  const searchCenter = useMemo(
    () => resolveSearchCenter(searchState.where, userLocation),
    [searchState.where, userLocation]
  );

  const loadMetaFeed = useCallback(async () => {
    setMetaFeedLoading(true);
    try {
      const timeScope = resolveEventTimeScope({ metaFilter });
      const data = await EventsService.listEvents({ limit: SEARCH_FETCH_LIMIT, timeScope });
      setMetaFeedEvents(data || []);
    } catch (error) {
      console.warn('[Home] loadMetaFeed failed', error);
      setMetaFeedEvents([]);
    } finally {
      setMetaFeedLoading(false);
    }
  }, [metaFilter]);

  useEffect(() => {
    if (showSearchResults) return;
    loadMetaFeed();
  }, [loadMetaFeed, showSearchResults]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!profile?.id) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const count = await NotificationsService.getUnreadCount();
      setUnreadNotifications(count);
    } catch {
      setUnreadNotifications(0);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadUnreadNotifications();
  }, [loadUnreadNotifications]);

  useEffect(() => {
    if (!profile?.id) return;
    return NotificationsService.subscribeToMyNotifications(profile.id, () => {
      loadUnreadNotifications();
    });
  }, [profile?.id, loadUnreadNotifications]);

  useEffect(() => {
    return NotificationsService.subscribeToLocalChanges(() => {
      loadUnreadNotifications();
    });
  }, [loadUnreadNotifications]);

  useEffect(() => {
    let cancelled = false;
    if (!showSearchResults) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (!hasSearchCriteria) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const searchTimeScope = resolveEventTimeScope({
      metaFilter: 'all',
      searchActive: true,
      includePast: !!searchState.when.includePast,
    });
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

          const featureCollection = await listEventsByBBoxForMap(
            { ne, sw, limit: SEARCH_FETCH_LIMIT },
            searchTimeScope,
            {
              mergeUpcomingForDatePreset:
                searchTimeScope === 'current' && !!searchState.when.preset,
            }
          );
          const ids =
            featureCollection?.features
              ?.map((f: any) => f?.properties?.id)
              .filter(Boolean) || [];
          const uniqueIds = Array.from(new Set(ids)) as string[];
          baseEvents = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
        } else {
          baseEvents = await EventsService.listEvents({
            limit: SEARCH_FETCH_LIMIT,
            timeScope: searchTimeScope,
          });
        }

        const filtered = filterEvents(baseEvents, filters, null);
        if (!cancelled) {
          setSearchResults(filtered);
        }
      } catch {
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
  }, [
    effectiveRadiusKm,
    filters,
    hasSearchCriteria,
    showSearchResults,
    searchCenter,
    searchState.searchRevision,
    searchState.when.includePast,
  ]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), showSearchResults ? Promise.resolve() : loadMetaFeed()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadMetaFeed, reload, showSearchResults]);

  const favoritesSet = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleToggleHeart = useCallback(
    async (event: EventWithCreator) => {
      if (!profile?.id) return;
      const before = {
        isLiked: likesSet.has(event.id),
        isFavorite: favoritesSet.has(event.id),
      };
      try {
        const after = await toggleEventHeart(profile.id, event, before);
        syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
      } catch (e) {
        console.warn('toggle heart error', e);
      }
    },
    [favoritesSet, likesSet, profile?.id, toggleFavorite, toggleLike]
  );

  const handlePressEvent = useCallback(
    (eventId: string) => {
      router.push(`/events/${eventId}` as any);
    },
    [router]
  );

  const handleNavigateEvent = useCallback((event: EventWithCreator) => {
    setNavEvent(event);
  }, []);

  const renderFeedItem = useCallback(
    ({ item }: { item: EventWithCreator }) => (
      <View style={styles.feedItemWrap}>
        <HomeFeedEventItem
          event={item}
          viewsCount={eventCardStatsById[item.id]?.viewsCount ?? 0}
          friendsGoingCount={eventCardStatsById[item.id]?.friendsGoingCount ?? 0}
          isHearted={likesSet.has(item.id) || favoritesSet.has(item.id)}
          onPressEvent={handlePressEvent}
          onNavigateEvent={handleNavigateEvent}
          onToggleHeart={handleToggleHeart}
        />
      </View>
    ),
    [
      eventCardStatsById,
      favoritesSet,
      handleNavigateEvent,
      handlePressEvent,
      handleToggleHeart,
      likesSet,
    ]
  );

  const keyExtractor = useCallback((item: EventWithCreator) => item.id, []);

  const renderNearbyItem = useCallback(
    (item: EventWithCreator) => (
      <MapResultCard
        key={item.id}
        event={item}
        onPress={() => handlePressEvent(item.id)}
        onOpenDetails={() => handlePressEvent(item.id)}
      />
    ),
    [handlePressEvent]
  );

  const listHeader = useMemo(
    () => (
      <>
        {canCreateNow ? (
          <View style={styles.storiesContainer}>
            <View style={styles.storiesHeader}>
              <Text style={styles.sectionTitle}>En ce moment</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesContent}
            >
              <TouchableOpacity
                style={styles.storyItem}
                onPress={() => router.push('/events/create/step-1' as any)}
                accessibilityRole="button"
                accessibilityLabel="Créer un événement"
              >
                <LinearGradient
                  colors={[accent.accent, accent.accent]}
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
                  Créer
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.nearbyContainer}>
          <View style={styles.storiesHeader}>
            <Text style={styles.sectionTitle}>Autour de vous</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/map' as any)}
              accessibilityRole="button"
              accessibilityLabel="Voir la carte"
            >
              <Text style={styles.seeAllText}>Voir la carte</Text>
            </TouchableOpacity>
          </View>
          {!userLocation ? (
            <View style={styles.nearbyEmpty}>
              <Text style={styles.nearbyEmptyText}>
                Activez la localisation pour voir les événements près de vous.
              </Text>
            </View>
          ) : nearbyEvents.length === 0 ? (
            <View style={styles.nearbyEmpty}>
              <Text style={styles.nearbyEmptyText}>
                Aucun événement à proximité pour le moment.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyCarouselContent}
            >
              {nearbyEvents.map(renderNearbyItem)}
            </ScrollView>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metaFilterRow}
          style={styles.metaFilterScroll}
        >
          {META_FILTER_OPTIONS.map((item) => {
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
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filtrer : ${item.label}`}
              >
                <Text style={[styles.metaFilterText, active && styles.metaFilterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
      </>
    ),
    [
      accent.accent,
      canCreateNow,
      metaFilter,
      nearbyEvents,
      profile?.avatar_url,
      renderNearbyItem,
      router,
      searchState,
      setSearchApplied,
      sortBy,
      sortOrder,
      userLocation,
    ]
  );

  if (loadingEvents) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground />
        <EventCardSkeleton count={2} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir mon profil"
          >
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
            <Text style={styles.headerSubtitle}>{greeting}</Text>
            <Text style={styles.headerTitle}>Moments Locaux</Text>
          </View>

          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => router.push('/notifications' as any)}
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} non lue${unreadNotifications > 1 ? 's' : ''}`
                : 'Notifications'
            }
          >
            <Bell size={20} color={colors.brand.secondary} />
            {unreadNotifications > 0 ? <View style={styles.notificationBadge} /> : null}
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <SearchBar
            onApply={() => setMetaFilter('all')}
            hasLocation={!!userLocation}
            applied={searchApplied}
            enableCommunitySearch
            placeholder="Rechercher des événements..."
          />
        </View>
      </View>

      <FlatList
        data={filteredAndSortedEvents}
        renderItem={renderFeedItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.secondary}
          />
        }
        ListEmptyComponent={
          searchLoading || metaFeedLoading ? (
            <EventCardSkeleton count={2} />
          ) : showSearchResults ? (
            <EmptyState
              icon={Search}
              title="Aucun événement pour ces critères"
              subtitle="Élargissez le rayon ou incluez les événements passés."
              ctaLabel="Effacer la recherche"
              onCtaPress={() => setSearchApplied(false)}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {metaFilter === 'upcoming'
                  ? 'Aucun événement à venir pour le moment.'
                  : metaFilter === 'past'
                    ? 'Aucun événement passé trouvé.'
                    : metaFilter === 'live'
                      ? 'Aucun événement en cours pour le moment.'
                      : 'Aucun événement trouvé'}
              </Text>
            </View>
          )
        }
      />

      <NavigationOptionsSheet
        visible={!!navEvent}
        event={navEvent}
        onClose={() => setNavEvent(null)}
        onOpenInAppMap={() => {
          if (!navEvent) return;
          const id = navEvent.id;
          setNavEvent(null);
          router.push(`/(tabs)/map?focus=${id}` as any);
        }}
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
  nearbyContainer: {
    paddingBottom: spacing.md,
  },
  nearbyCarouselContent: {
    paddingHorizontal: spacing.md,
  },
  nearbyEmpty: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  nearbyEmptyText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
  },
  metaFilterScroll: {
    marginBottom: spacing.md,
    flexGrow: 0,
  },
  metaFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
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
    gap: spacing.lg,
  },
  feedItemWrap: {
    paddingHorizontal: spacing.md,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
});
