import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { useAuth, useLocation } from '@/hooks';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useDiscoveryFiltersStore } from '@/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import { filterEvents, filterEventsByMetaStatus } from '@/utils/filter-events';
import { syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { sortEvents } from '@/utils/sort-events';
import { colors, spacing, typography } from '@/constants/theme';
import {
  DEFAULT_DISCOVERY_STATUS,
  DISCOVERY_DEFAULT_RADIUS_KM,
  DISCOVERY_MAX_RADIUS_KM,
  metaFilterLabel,
} from '@/constants/filters';
import { EventResultCard } from '@/components/search/EventResultCard';
import type { EventWithCreator } from '@/types/database';
import { SearchBar } from '@/components/search/SearchBar';
import { NotificationsService } from '@/services/notifications.service';
import {
  ActiveFiltersBar,
  SortControl,
  StatusFilterRow,
  type ActiveFilterChip,
} from '@/components/filters';
import {
  hasSearchCriteria as checkSearchCriteria,
  getBoundsFromRadiusKm,
  resolveEffectiveRadiusKm,
  resolveSearchCenter,
  SEARCH_FETCH_LIMIT,
} from '@/utils/search-helpers';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { DiscoveryLoadingState, EmptyState } from '@/components/ui';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { buildSearchSummary } from '@/utils/search-summary';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import {
  toEventFilters,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';

const HOME_FEED_LIMIT = SEARCH_FETCH_LIMIT;
const HOME_CARD_STATS_LIMIT = 40;
const HOME_FEED_CACHE_TTL_MS = 2 * 60 * 1000;

let homeFeedCache: {
  key: string;
  events: EventWithCreator[];
  storedAt: number;
} | null = null;

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
  const {
    currentLocation,
    isLoading: locationLoading,
    error: locationError,
    requestPermission: requestLocationPermission,
  } = useLocation();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const status = useDiscoveryFiltersStore((s) => s.status);
  const when = useDiscoveryFiltersStore((s) => s.when);
  const place = useDiscoveryFiltersStore((s) => s.place);
  const content = useDiscoveryFiltersStore((s) => s.content);
  const sort = useDiscoveryFiltersStore((s) => s.sort);
  const mapMode = useDiscoveryFiltersStore((s) => s.mapMode);
  const setStatus = useDiscoveryFiltersStore((s) => s.setStatus);
  const setRadiusKm = useDiscoveryFiltersStore((s) => s.setRadiusKm);
  const setSort = useDiscoveryFiltersStore((s) => s.setSort);
  const setSortOrder = useDiscoveryFiltersStore((s) => s.setSortOrder);
  const searchApplied = useDiscoveryFiltersStore((s) => s.searchApplied);
  const searchRevision = useDiscoveryFiltersStore((s) => s.searchRevision);
  const setSearchApplied = useDiscoveryFiltersStore((s) => s.setSearchApplied);
  const clearSearchCriteria = useDiscoveryFiltersStore((s) => s.clearSearchCriteria);
  const resetCriteria = useDiscoveryFiltersStore((s) => s.resetCriteria);
  const categories = useTaxonomyStore((s) => s.categories);
  const subcategories = useTaxonomyStore((s) => s.subcategories);
  const [refreshing, setRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<EventWithCreator[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [metaFeedEvents, setMetaFeedEvents] = useState<EventWithCreator[]>([]);
  const [metaFeedLoading, setMetaFeedLoading] = useState(true);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [eventCardStatsById, setEventCardStatsById] = useState<Record<string, EventCardStats>>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const metaFeedRequestId = useRef(0);
  const insets = useSafeAreaInsets();

  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Salut, ${firstName}` : 'Salut';

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

  const browseCenter = place.center ?? userLocation;
  const browseRadiusKm = place.radiusKm ?? DISCOVERY_DEFAULT_RADIUS_KM;

  const filteredAndSortedEvents = useMemo(() => {
    const base = showSearchResults ? searchResults : metaFeedEvents;
    const metaFiltered = filterEventsByMetaStatus(base, status);
    return sortEvents(metaFiltered, sortBy, browseCenter, sortOrder);
  }, [browseCenter, metaFeedEvents, searchResults, showSearchResults, sortBy, sortOrder, status]);

  const filteredEventIds = useMemo(
    () =>
      filteredAndSortedEvents
        .slice(0, HOME_CARD_STATS_LIMIT)
        .map((event) => event.id)
        .filter(Boolean),
    [filteredAndSortedEvents],
  );
  const filteredEventIdsKey = useMemo(() => filteredEventIds.join(','), [filteredEventIds]);

  useEffect(() => {
    if (!hasSearchCriteria && searchApplied) {
      setSearchApplied(false);
    }
  }, [hasSearchCriteria, searchApplied, setSearchApplied]);

  const effectiveRadiusKm = useMemo(
    () =>
      resolveEffectiveRadiusKm(place, userLocation) ??
      (userLocation
        ? place.radiusKm && place.radiusKm > 0
          ? place.radiusKm
          : DISCOVERY_DEFAULT_RADIUS_KM
        : undefined),
    [place, userLocation]
  );

  const searchCenter = useMemo(
    () => resolveSearchCenter(place, userLocation) ?? userLocation,
    [place, userLocation]
  );

  const loadMetaFeed = useCallback(async (forceRefresh = false) => {
    const requestId = ++metaFeedRequestId.current;
    if (!browseCenter) {
      setMetaFeedEvents([]);
      setMetaFeedLoading(false);
      return;
    }

    setMetaFeedLoading(true);
    try {
      const timeScope = resolveEventTimeScope({
        metaFilter: status,
        includePast: status === 'past',
      });
      const cacheKey = [
        browseCenter.latitude.toFixed(3),
        browseCenter.longitude.toFixed(3),
        browseRadiusKm,
        timeScope,
      ].join(':');
      if (
        !forceRefresh &&
        homeFeedCache?.key === cacheKey &&
        Date.now() - homeFeedCache.storedAt < HOME_FEED_CACHE_TTL_MS
      ) {
        if (requestId === metaFeedRequestId.current) {
          setMetaFeedEvents(homeFeedCache.events);
        }
        return;
      }

      const bounds = getBoundsFromRadiusKm(
        browseCenter.latitude,
        browseCenter.longitude,
        browseRadiusKm
      );
      const viewport = await listMapViewportForMap(
        { ...bounds, limit: HOME_FEED_LIMIT },
        timeScope
      );
      // The RPC uses a rectangle; enforce the requested circular radius client-side.
      const events = filterEvents(viewport.events || [], {
        centerLat: browseCenter.latitude,
        centerLon: browseCenter.longitude,
        radiusKm: browseRadiusKm,
        includePast: status === 'past',
      });
      homeFeedCache = { key: cacheKey, events, storedAt: Date.now() };
      if (requestId === metaFeedRequestId.current) {
        setMetaFeedEvents(events);
      }
    } catch (error) {
      console.warn('[Home] loadMetaFeed failed', error);
      if (requestId === metaFeedRequestId.current) {
        setMetaFeedEvents([]);
      }
    } finally {
      if (requestId === metaFeedRequestId.current) {
        setMetaFeedLoading(false);
      }
    }
  }, [browseCenter, browseRadiusKm, status]);

  useEffect(() => {
    if (showSearchResults) return;
    if (!browseCenter && (locationLoading || (!locationError && !currentLocation))) return;
    loadMetaFeed();
  }, [browseCenter, currentLocation, loadMetaFeed, locationError, locationLoading, showSearchResults]);

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
          const bounds = getBoundsFromRadiusKm(
            searchCenter.latitude,
            searchCenter.longitude,
            effectiveRadiusKm
          );
          const viewport = await listMapViewportForMap(
            { ...bounds, limit: SEARCH_FETCH_LIMIT },
            searchTimeScope,
            {
              mergeUpcomingForDatePreset:
                searchTimeScope === 'current' && !!when.preset,
            }
          );
          baseEvents = viewport.events || [];
        }

        const filtered = filterEvents(
          baseEvents,
          searchCenter && effectiveRadiusKm
            ? {
                ...filters,
                centerLat: searchCenter.latitude,
                centerLon: searchCenter.longitude,
                radiusKm: effectiveRadiusKm,
              }
            : filters,
          null
        );
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
      if (!showSearchResults) {
        await loadMetaFeed(true);
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadMetaFeed, showSearchResults]);

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

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (showSearchResults) {
      const summary = buildSearchSummary(
        discoveryFilters,
        categories,
        subcategories,
        'home'
      );
      chips.push({
        key: 'search',
        label: summary || 'Recherche active',
        onClear: clearSearchCriteria,
      });
    }
    if (status !== DEFAULT_DISCOVERY_STATUS) {
      chips.push({
        key: 'status',
        label: metaFilterLabel(status),
        onClear: () => setStatus(DEFAULT_DISCOVERY_STATUS),
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
  ]);

  const expandedRadiusKm = Math.min(
    DISCOVERY_MAX_RADIUS_KM,
    Math.max(40, browseRadiusKm * 2)
  );
  const canExpandRadius = browseRadiusKm < DISCOVERY_MAX_RADIUS_KM;
  const openSearch = useCallback(() => {
    router.push('/(tabs)/map' as any);
  }, [router]);

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
            onSelectionChange={(value, order) => setSort('home', value, order)}
            sortOrder={sortOrder}
            onSortOrderChange={(order) => setSortOrder('home', order)}
            hasLocation={!!browseCenter}
            mode="pill"
            status={status}
          />
        </View>
      </>
    ),
    [
      accent.accent,
      activeFilterChips,
      browseCenter,
      canCreateNow,
      profile?.avatar_url,
      router,
      resetCriteria,
      setSort,
      setSortOrder,
      setStatus,
      sortBy,
      sortOrder,
      status,
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
          (showSearchResults ? searchLoading : metaFeedLoading) ? (
            <DiscoveryLoadingState
              title={
                showSearchResults
                  ? 'Nous recherchons les événements qui vous correspondent'
                  : 'Nous recherchons les meilleurs événements à proximité pour vous'
              }
              subtitle={
                showSearchResults
                  ? 'Nous appliquons vos critères de recherche.'
                  : `Événements en cours dans un rayon de ${browseRadiusKm} km.`
              }
            />
          ) : !browseCenter ? (
            <EmptyState
              icon={Search}
              title="Localisation nécessaire"
              subtitle="Activez la localisation pour afficher les événements en cours à moins de 20 km, ou lancez une recherche par lieu."
              ctaLabel="Activer la localisation"
              onCtaPress={requestLocationPermission}
              secondaryCtaLabel="Rechercher un lieu"
              onSecondaryCtaPress={openSearch}
            />
          ) : showSearchResults ? (
            <EmptyState
              icon={Search}
              title="Aucun événement pour ces critères"
              subtitle={`Aucun résultat dans un rayon de ${browseRadiusKm} km.`}
              ctaLabel={canExpandRadius ? `Élargir à ${expandedRadiusKm} km` : 'Effacer la recherche'}
              onCtaPress={
                canExpandRadius
                  ? () => setRadiusKm(expandedRadiusKm)
                  : clearSearchCriteria
              }
              secondaryCtaLabel="Modifier la recherche"
              onSecondaryCtaPress={openSearch}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={
                status === 'live'
                  ? 'Aucun événement en cours à proximité'
                  : 'Aucun événement à proximité'
              }
              subtitle={`Aucun résultat dans un rayon de ${browseRadiusKm} km.`}
              ctaLabel={canExpandRadius ? `Élargir à ${expandedRadiusKm} km` : 'Lancer une recherche'}
              onCtaPress={
                canExpandRadius
                  ? () => setRadiusKm(expandedRadiusKm)
                  : openSearch
              }
              secondaryCtaLabel={canExpandRadius ? 'Lancer une recherche' : undefined}
              onSecondaryCtaPress={canExpandRadius ? openSearch : undefined}
            />
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
    // backgroundColor: colors.brand.page, // Removed to allow AppBackground to show
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  loadingText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    // backgroundColor: colors.brand.page, // Removed for uniformity
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
    backgroundColor: colors.brand.page,
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
    backgroundColor: colors.brand.page, // Create a gap effect
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
