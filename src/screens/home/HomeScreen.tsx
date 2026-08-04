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
import { useAuth } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useLocationStore, useDiscoveryFiltersStore } from '@/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { filterEvents, filterEventsByMetaStatus } from '@/utils/filter-events';
import { syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { sortEvents } from '@/utils/sort-events';
import { colors, spacing, typography } from '@/constants/theme';
import { DISCOVERY_DEFAULT_RADIUS_KM, metaFilterLabel } from '@/constants/filters';
import { EventResultCard } from '@/components/search/EventResultCard';
import { MapResultCard } from '@/components/search/MapResultCard';
import type { EventWithCreator } from '@/types/database';
import { SearchBar } from '@/components/search/SearchBar';
import { EventsService } from '@/services/events.service';
import { NotificationsService } from '@/services/notifications.service';
import {
  ActiveFiltersBar,
  SortControl,
  StatusFilterRow,
  type ActiveFilterChip,
} from '@/components/filters';
import {
  hasSearchCriteria as checkSearchCriteria,
  resolveEffectiveRadiusKm,
  resolveSearchCenter,
  SEARCH_FETCH_LIMIT,
} from '@/utils/search-helpers';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { listEventsByBBoxForMap } from '@/utils/bbox-event-fetch';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { EmptyState, EventCardSkeleton } from '@/components/ui';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { buildSearchSummary } from '@/utils/search-summary';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import {
  toEventFilters,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';

const NEARBY_CAROUSEL_LIMIT = 12;

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
  const status = useDiscoveryFiltersStore((s) => s.status);
  const when = useDiscoveryFiltersStore((s) => s.when);
  const place = useDiscoveryFiltersStore((s) => s.place);
  const content = useDiscoveryFiltersStore((s) => s.content);
  const sort = useDiscoveryFiltersStore((s) => s.sort);
  const mapMode = useDiscoveryFiltersStore((s) => s.mapMode);
  const setStatus = useDiscoveryFiltersStore((s) => s.setStatus);
  const setSort = useDiscoveryFiltersStore((s) => s.setSort);
  const setSortOrder = useDiscoveryFiltersStore((s) => s.setSortOrder);
  const searchApplied = useDiscoveryFiltersStore((s) => s.searchApplied);
  const searchRevision = useDiscoveryFiltersStore((s) => s.searchRevision);
  const setSearchApplied = useDiscoveryFiltersStore((s) => s.setSearchApplied);
  const clearSearchCriteria = useDiscoveryFiltersStore((s) => s.clearSearchCriteria);
  const resetCriteria = useDiscoveryFiltersStore((s) => s.resetCriteria);
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const tags = useTaxonomyStore((s) => s.tags);
  const [refreshing, setRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<EventWithCreator[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [metaFeedEvents, setMetaFeedEvents] = useState<EventWithCreator[]>([]);
  const [metaFeedLoading, setMetaFeedLoading] = useState(false);
  const [nearbyPool, setNearbyPool] = useState<EventWithCreator[]>([]);
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

  const discoveryFilters = useMemo<DiscoveryFilters>(
    () => ({ status, when, place, content, sort, mapMode }),
    [content, mapMode, place, sort, status, when]
  );
  const filters = useMemo(
    () => toEventFilters(discoveryFilters, userLocation),
    [discoveryFilters, userLocation]
  );
  const homeSort = sort.home;
  const sortBy = homeSort.sortBy;
  const sortOrder = homeSort.sortOrder;
  const hasSearchCriteria = useMemo(
    () => checkSearchCriteria({ place, when, content }),
    [content, place, when]
  );
  /** Search stays applied when changing status — axes are cumulative. */
  const showSearchResults = searchApplied && hasSearchCriteria;

  const filteredAndSortedEvents = useMemo(() => {
    const base = showSearchResults ? searchResults : metaFeedEvents;
    const metaFiltered = filterEventsByMetaStatus(base, status);
    return sortEvents(metaFiltered, sortBy, userLocation, sortOrder);
  }, [metaFeedEvents, searchResults, showSearchResults, sortBy, sortOrder, status, userLocation]);

  /** Nearby carousel: live + upcoming within default radius, distance ASC — independent of status chips. */
  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];
    const live = filterEventsByMetaStatus(nearbyPool, 'live');
    const upcoming = filterEventsByMetaStatus(nearbyPool, 'upcoming');
    const byId = new Map<string, EventWithCreator>();
    for (const event of [...live, ...upcoming]) {
      byId.set(event.id, event);
    }
    const withinRadius = filterEvents([...byId.values()], {
      centerLat: userLocation.latitude,
      centerLon: userLocation.longitude,
      radiusKm: DISCOVERY_DEFAULT_RADIUS_KM,
      includePast: false,
    });
    return sortEvents(withinRadius, 'distance', userLocation).slice(0, NEARBY_CAROUSEL_LIMIT);
  }, [nearbyPool, userLocation]);

  const filteredEventIds = useMemo(
    () => filteredAndSortedEvents.map((event) => event.id).filter(Boolean),
    [filteredAndSortedEvents],
  );
  const filteredEventIdsKey = useMemo(() => filteredEventIds.join(','), [filteredEventIds]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
    }
  }, [hasSearchCriteria, searchApplied, setSearchApplied]);

  const effectiveRadiusKm = useMemo(
    () => resolveEffectiveRadiusKm(place, userLocation),
    [place, userLocation]
  );

  const searchCenter = useMemo(
    () => resolveSearchCenter(place, userLocation),
    [place, userLocation]
  );

  const loadMetaFeed = useCallback(async () => {
    setMetaFeedLoading(true);
    try {
      const timeScope = resolveEventTimeScope({
        metaFilter: status,
        includePast: status === 'past',
      });
      const data = await EventsService.listEvents({ limit: SEARCH_FETCH_LIMIT, timeScope });
      setMetaFeedEvents(data || []);
    } catch (error) {
      console.warn('[Home] loadMetaFeed failed', error);
      setMetaFeedEvents([]);
    } finally {
      setMetaFeedLoading(false);
    }
  }, [status]);

  const loadNearbyPool = useCallback(async () => {
    if (!userLocation) {
      setNearbyPool([]);
      return;
    }
    try {
      // `current` = live + upcoming so the carousel is not stuck on ongoing-only supply.
      const data = await EventsService.listEvents({
        limit: SEARCH_FETCH_LIMIT,
        timeScope: 'current',
      });
      setNearbyPool(data || []);
    } catch (error) {
      console.warn('[Home] loadNearbyPool failed', error);
      setNearbyPool([]);
    }
  }, [userLocation]);

  useEffect(() => {
    if (showSearchResults) return;
    loadMetaFeed();
  }, [loadMetaFeed, showSearchResults]);

  useEffect(() => {
    loadNearbyPool();
  }, [loadNearbyPool]);

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
      metaFilter: status,
      searchActive: true,
      includePast: !!when.includePast,
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
                searchTimeScope === 'current' && !!when.preset,
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
    searchRevision,
    status,
    when.includePast,
    when.preset,
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
      await Promise.all([
        loadNearbyPool(),
        showSearchResults ? Promise.resolve() : loadMetaFeed(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadMetaFeed, loadNearbyPool, showSearchResults]);

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

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (showSearchResults) {
      const summary = buildSearchSummary(
        discoveryFilters,
        categories,
        subcategories,
        tags,
        'home'
      );
      chips.push({
        key: 'search',
        label: summary || 'Recherche active',
        onClear: clearSearchCriteria,
      });
    }
    if (status !== 'all') {
      chips.push({
        key: 'status',
        label: metaFilterLabel(status),
        onClear: () => setStatus('all'),
      });
    }
    return chips;
  }, [
    categories,
    clearSearchCriteria,
    discoveryFilters,
    setStatus,
    showSearchResults,
    status,
    subcategories,
    tags,
  ]);

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

        <StatusFilterRow
          value={status}
          onChange={setStatus}
          style={styles.statusFilterRow}
        />

        <ActiveFiltersBar
          chips={activeFilterChips}
          onClearAll={
            activeFilterChips.length > 1
              ? () => {
                  resetCriteria();
                }
              : undefined
          }
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pour vous</Text>
          <SortControl
            value={sortBy}
            onChange={(value) => setSort('home', value, sortOrder)}
            sortOrder={sortOrder}
            onSortOrderChange={(order) => setSortOrder('home', order)}
            hasLocation={!!userLocation}
            mode="pill"
          />
        </View>
      </>
    ),
    [
      accent.accent,
      activeFilterChips,
      canCreateNow,
      nearbyEvents,
      profile?.avatar_url,
      renderNearbyItem,
      router,
      resetCriteria,
      setSort,
      setSortOrder,
      setStatus,
      sortBy,
      sortOrder,
      status,
      userLocation,
    ]
  );

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
            onApply={() => {
              /* Keep current status — search and status axes are cumulative. */
            }}
            hasLocation={!!userLocation}
            applied={searchApplied}
            surface="home"
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
              subtitle="Élargissez le rayon ou ajustez le statut temporel."
              ctaLabel="Effacer la recherche"
              onCtaPress={clearSearchCriteria}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {status === 'upcoming'
                  ? 'Aucun événement à venir pour le moment.'
                  : status === 'past'
                    ? 'Aucun événement passé trouvé.'
                    : status === 'live'
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
  statusFilterRow: {
    marginBottom: spacing.sm,
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
