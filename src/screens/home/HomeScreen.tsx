import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bell, Map as MapIcon, MapPin, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventResultCard } from '@/components/search/EventResultCard';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { DiscoveryLoadingState, EmptyState } from '@/components/ui';
import {
  DISCOVERY_DEFAULT_RADIUS_KM,
  DISCOVERY_MAX_RADIUS_KM,
} from '@/constants/filters';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth, useLocation } from '@/hooks';
import { NotificationsService } from '@/services/notifications.service';
import { EventCardStatsService, type EventCardStats } from '@/services/event-card-stats.service';
import { useDiscoveryFiltersStore } from '@/store';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';
import type { EventWithCreator } from '@/types/database';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { filterEvents } from '@/utils/filter-events';
import { getBoundsFromRadiusKm, SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import { sortEvents } from '@/utils/sort-events';

const HOME_RADIUS_OPTIONS = [10, DISCOVERY_DEFAULT_RADIUS_KM, 40, 80] as const;
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
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const {
    currentLocation,
    isLoading: locationLoading,
    error: locationError,
    requestPermission: requestLocationPermission,
  } = useLocation();
  const favorites = useFavoritesStore((state) => state.favorites);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const likedEventIds = useLikesStore((state) => state.likedEventIds);
  const toggleLike = useLikesStore((state) => state.toggleLike);
  const setMapStatus = useDiscoveryFiltersStore((state) => state.setStatus);
  const setMapRadius = useDiscoveryFiltersStore((state) => state.setRadiusKm);

  const [homeRadiusKm, setHomeRadiusKm] = useState(DISCOVERY_DEFAULT_RADIUS_KM);
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [eventCardStatsById, setEventCardStatsById] = useState<Record<string, EventCardStats>>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const requestIdRef = useRef(0);

  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Salut, ${firstName} 👋` : 'Salut 👋';
  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const sortedEvents = useMemo(
    () => sortEvents(events, 'distance', userLocation, 'asc'),
    [events, userLocation],
  );

  const loadHomeFeed = useCallback(async (forceRefresh = false) => {
    const requestId = ++requestIdRef.current;
    if (!userLocation) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const cacheKey = [
        userLocation.latitude.toFixed(3),
        userLocation.longitude.toFixed(3),
        homeRadiusKm,
        'ongoing',
      ].join(':');

      if (
        !forceRefresh &&
        homeFeedCache?.key === cacheKey &&
        Date.now() - homeFeedCache.storedAt < HOME_FEED_CACHE_TTL_MS
      ) {
        if (requestId === requestIdRef.current) setEvents(homeFeedCache.events);
        return;
      }

      const bounds = getBoundsFromRadiusKm(
        userLocation.latitude,
        userLocation.longitude,
        homeRadiusKm,
      );
      const viewport = await listMapViewportForMap(
        { ...bounds, limit: SEARCH_FETCH_LIMIT },
        'ongoing',
      );
      const withinRadius = filterEvents(viewport.events || [], {
        centerLat: userLocation.latitude,
        centerLon: userLocation.longitude,
        radiusKm: homeRadiusKm,
        time: 'live',
        includePast: false,
      });

      homeFeedCache = { key: cacheKey, events: withinRadius, storedAt: Date.now() };
      if (requestId === requestIdRef.current) setEvents(withinRadius);
    } catch (error) {
      console.warn('[Home] nearby feed failed', error);
      if (requestId === requestIdRef.current) setEvents([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [homeRadiusKm, userLocation]);

  useEffect(() => {
    if (!userLocation && (locationLoading || (!locationError && !currentLocation))) return;
    void loadHomeFeed();
  }, [currentLocation, loadHomeFeed, locationError, locationLoading, userLocation]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!profile?.id) {
      setUnreadNotifications(0);
      return;
    }
    try {
      setUnreadNotifications(await NotificationsService.getUnreadCount());
    } catch {
      setUnreadNotifications(0);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadUnreadNotifications();
  }, [loadUnreadNotifications]);

  useEffect(() => {
    if (!profile?.id) return;
    return NotificationsService.subscribeToMyNotifications(profile.id, () => {
      void loadUnreadNotifications();
    });
  }, [loadUnreadNotifications, profile?.id]);

  useEffect(() => NotificationsService.subscribeToLocalChanges(() => {
    void loadUnreadNotifications();
  }), [loadUnreadNotifications]);

  const visibleEventIds = useMemo(
    () => sortedEvents.slice(0, HOME_CARD_STATS_LIMIT).map((event) => event.id).filter(Boolean),
    [sortedEvents],
  );
  const visibleEventIdsKey = useMemo(() => visibleEventIds.join(','), [visibleEventIds]);

  useEffect(() => {
    let cancelled = false;
    if (!visibleEventIds.length) {
      setEventCardStatsById({});
      return;
    }

    void EventCardStatsService.getStatsForEvents(visibleEventIds, profile?.id)
      .then((stats) => {
        if (!cancelled) setEventCardStatsById(stats);
      })
      .catch(() => {
        if (!cancelled) setEventCardStatsById({});
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id, visibleEventIds, visibleEventIdsKey]);

  const favoritesSet = useMemo(() => new Set(favorites.map((event) => event.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleToggleHeart = useCallback(async (event: EventWithCreator) => {
    if (!profile?.id) return;
    const before = {
      isLiked: likesSet.has(event.id),
      isFavorite: favoritesSet.has(event.id),
    };
    try {
      const after = await toggleEventHeart(profile.id, event, before);
      syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
    } catch (error) {
      console.warn('[Home] toggle heart failed', error);
    }
  }, [favoritesSet, likesSet, profile?.id, toggleFavorite, toggleLike]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHomeFeed(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeFeed]);

  const openMap = useCallback((status: 'live' | 'upcoming' = 'live') => {
    setMapStatus(status);
    setMapRadius(homeRadiusKm);
    router.push('/(tabs)/map' as any);
  }, [homeRadiusKm, router, setMapRadius, setMapStatus]);

  const renderFeedItem = useCallback(({ item }: { item: EventWithCreator }) => (
    <View style={styles.feedItemWrap}>
      <HomeFeedEventItem
        event={item}
        viewsCount={eventCardStatsById[item.id]?.viewsCount ?? 0}
        friendsGoingCount={eventCardStatsById[item.id]?.friendsGoingCount ?? 0}
        isHearted={likesSet.has(item.id) || favoritesSet.has(item.id)}
        onPressEvent={(eventId) => router.push(`/events/${eventId}` as any)}
        onNavigateEvent={setNavEvent}
        onToggleHeart={handleToggleHeart}
      />
    </View>
  ), [eventCardStatsById, favoritesSet, handleToggleHeart, likesSet, router]);

  const expandedRadiusKm = Math.min(
    DISCOVERY_MAX_RADIUS_KM,
    homeRadiusKm < 40 ? homeRadiusKm * 2 : homeRadiusKm + 20,
  );
  const canExpandRadius = homeRadiusKm < DISCOVERY_MAX_RADIUS_KM;

  const listHeader = (
    <View style={styles.feedIntro}>
      <View style={styles.feedTitleRow}>
        <View style={styles.feedTitleCopy}>
          <Text style={styles.feedEyebrow}>MAINTENANT</Text>
          <Text style={styles.feedTitle}>En cours autour de toi</Text>
          <Text style={styles.feedSubtitle}>
            {loading
              ? 'Nous préparons ta sélection locale.'
              : `${sortedEvents.length} moment${sortedEvents.length > 1 ? 's' : ''}, du plus proche au plus éloigné.`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => openMap('live')}
          accessibilityRole="button"
          accessibilityLabel="Voir les événements en cours sur la carte"
        >
          <MapIcon size={19} color={colors.brand.secondary} />
          <Text style={styles.mapButtonText}>Carte</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.locationContext}>
        <MapPin size={18} color={colors.brand.secondary} />
        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>Point de départ</Text>
          <Text style={styles.locationValue}>
            {userLocation ? 'Ma position actuelle' : 'Localisation indisponible'}
          </Text>
        </View>
        <Text style={styles.radiusValue}>{homeRadiusKm} km</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.radiusOptions}
        accessibilityRole="radiogroup"
      >
        {HOME_RADIUS_OPTIONS.map((radius) => {
          const selected = radius === homeRadiusKm;
          return (
            <TouchableOpacity
              key={radius}
              style={[styles.radiusChip, selected && styles.radiusChipActive]}
              onPress={() => setHomeRadiusKm(radius)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Rayon de ${radius} kilomètres`}
            >
              <Text style={[styles.radiusChipText, selected && styles.radiusChipTextActive]}>
                {radius} km
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
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
              <View style={[styles.headerAvatar, styles.headerAvatarFallback]} />
            )}
            <View style={styles.headerAvatarIcon}>
              <Image source={require('../../../assets/images/icon.png')} style={styles.appIcon} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerSubtitle}>{greeting}</Text>
          <Text style={styles.headerTitle}>Moments Locaux</Text>
        </View>

        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/notifications' as any)}
          accessibilityRole="button"
          accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} non lues` : 'Notifications'}
        >
          <Bell size={20} color={colors.brand.secondary} />
          {unreadNotifications > 0 ? <View style={styles.notificationBadge} /> : null}
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedEvents}
        renderItem={renderFeedItem}
        keyExtractor={(event) => event.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.secondary}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <DiscoveryLoadingState
              title="Nous recherchons les meilleurs événements à proximité pour toi"
              subtitle={`Événements en cours dans un rayon de ${homeRadiusKm} km.`}
            />
          ) : !userLocation ? (
            <EmptyState
              icon={MapPin}
              title="Localisation nécessaire"
              subtitle="Active ta localisation pour afficher les événements en cours autour de toi."
              ctaLabel="Activer la localisation"
              onCtaPress={requestLocationPermission}
              secondaryCtaLabel="Rechercher un lieu sur la carte"
              onSecondaryCtaPress={() => openMap('live')}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={`Aucun moment en cours à moins de ${homeRadiusKm} km`}
              subtitle="Tu peux élargir la zone ou consulter les événements qui commencent bientôt."
              ctaLabel={canExpandRadius ? `Élargir à ${expandedRadiusKm} km` : 'Voir ceux à venir'}
              onCtaPress={canExpandRadius ? () => setHomeRadiusKm(expandedRadiusKm) : () => openMap('upcoming')}
              secondaryCtaLabel={canExpandRadius ? 'Voir ceux à venir' : 'Choisir un autre lieu'}
              onSecondaryCtaPress={canExpandRadius ? () => openMap('upcoming') : () => openMap('live')}
            />
          )
        }
      />

      <NavigationOptionsSheet
        visible={Boolean(navEvent)}
        event={navEvent}
        onClose={() => setNavEvent(null)}
        onOpenInAppMap={() => {
          if (!navEvent) return;
          const eventId = navEvent.id;
          setNavEvent(null);
          router.push(`/(tabs)/map?focus=${eventId}` as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerAvatarContainer: { position: 'relative' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerAvatarFallback: { backgroundColor: colors.brand.secondary },
  headerAvatarIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    padding: 2,
    borderRadius: 8,
    backgroundColor: colors.brand.primary,
  },
  appIcon: { width: 12, height: 12 },
  headerCenter: { alignItems: 'center' },
  headerSubtitle: { ...typography.caption, color: colors.brand.textSecondary, fontWeight: '600' },
  headerTitle: { ...typography.h4, color: colors.brand.text, lineHeight: 24 },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.brand.surface,
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.brand.surface,
    backgroundColor: colors.brand.secondary,
  },
  listContent: { paddingBottom: 120, gap: spacing.lg },
  feedIntro: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  feedTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  feedTitleCopy: { flex: 1 },
  feedEyebrow: {
    ...typography.label,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.brand.secondary,
  },
  feedTitle: { ...typography.h3, color: colors.brand.text, marginTop: 3 },
  feedSubtitle: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: spacing.xs },
  mapButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(43, 191, 227, 0.35)',
    backgroundColor: 'rgba(43, 191, 227, 0.08)',
  },
  mapButtonText: { ...typography.label, color: colors.brand.secondary },
  locationContext: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: colors.brand.surface,
  },
  locationCopy: { flex: 1 },
  locationLabel: { ...typography.caption, color: colors.brand.textSecondary },
  locationValue: { ...typography.label, color: colors.brand.text, marginTop: 2 },
  radiusValue: { ...typography.bodyBold, color: colors.brand.secondary },
  radiusOptions: { gap: spacing.sm, paddingRight: spacing.lg },
  radiusChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: colors.brand.surface,
  },
  radiusChipActive: { borderColor: colors.brand.secondary, backgroundColor: colors.brand.secondary },
  radiusChipText: { ...typography.label, color: colors.brand.textSecondary },
  radiusChipTextActive: { color: colors.brand.primary },
  feedItemWrap: { paddingHorizontal: spacing.md },
});
