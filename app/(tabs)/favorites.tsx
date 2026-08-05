import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronDown, Compass, Heart, MapPin, Search } from 'lucide-react-native';

import { AppBackground, DiscoveryLoadingState, EmptyState } from '@/components/ui';
import { EventCard } from '@/components/events/EventCard';
import { NavigationOptionsSheet } from '@/components/search/NavigationOptionsSheet';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { useAuth, useLocation } from '@/hooks';
import { supabase } from '@/lib/supabase/client';
import { EventsService } from '@/services/events.service';
import { CommunityService } from '@/services/community.service';
import { useFavoritesStore } from '@/store/favoritesStore';
import type { EventWithCreator } from '@/types/database';
import type { CommunityMember } from '@/types/community';
import { syncHeartStores, toggleEventHeart } from '@/utils/event-heart';
import { useLikesStore } from '@/store/likesStore';
import {
  DEFAULT_FAVORITE_TIME_FILTER,
  filterFavoriteEvents,
  type FavoriteTimeFilter,
} from '@/utils/favorite-events';
import { calculateDistanceKm, sortEvents } from '@/utils/sort-events';

type FavoriteRow = {
  event_id: string;
  created_at: string;
};

type Tab = 'events' | 'creators';
type FavoriteSort = 'distance' | 'date_asc' | 'date_desc';

const TIME_FILTERS: { value: FavoriteTimeFilter; label: string }[] = [
  { value: 'active', label: 'En cours & à venir' },
  { value: 'live', label: 'En cours' },
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passés' },
  { value: 'all', label: 'Tous' },
];

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, session, isLoading } = useAuth();
  const { currentLocation, isLoading: locationLoading } = useLocation();
  const { favorites, replaceFavorites, clearFavorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();

  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [query, setQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<FavoriteTimeFilter>(DEFAULT_FAVORITE_TIME_FILTER);
  const [favoriteSort, setFavoriteSort] = useState<FavoriteSort>('distance');
  const [creatorFavorites, setCreatorFavorites] = useState<CommunityMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [navEvent, setNavEvent] = useState<EventWithCreator | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const loadFavorites = useCallback(async () => {
    setLoadingFavorites(true);
    const followerId = user?.id || session?.user?.id || profile?.id;
    const favoritesOwnerId = profile?.id || followerId;
    if (!session || !followerId || !favoritesOwnerId) {
      replaceFavorites([]);
      setCreatorFavorites([]);
      setInitialLoading(false);
      setLoadingFavorites(false);
      return;
    }

    try {
      const [favoritesResult, followsResult] = await Promise.all([
        supabase
          .from('favorites')
          .select('event_id, created_at')
          .eq('profile_id', favoritesOwnerId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('follows')
          .select('following, created_at, profile:profiles!follows_following_fkey(id, display_name, avatar_url, cover_url, city, bio)')
          .eq('follower', followerId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const { data: favoritesData, error: favoritesError } = favoritesResult;
      const { data: followsData, error: followsError } = followsResult;

      if (favoritesError) throw favoritesError;
      if (followsError) throw followsError;

      const favoriteRows = (favoritesData || []) as FavoriteRow[];
      const eventIds = favoriteRows.map((row) => row.event_id).filter(Boolean);
      const followRows = (followsData || []) as any[];
      const events = eventIds.length ? await EventsService.getEventsByIds(eventIds) : [];

      const byId = new Map(events.map((event) => [event.id, event]));
      const ordered = eventIds.map((id) => byId.get(id)).filter(Boolean) as EventWithCreator[];
      replaceFavorites(ordered);

      const creators = followRows
        .map((row) => {
          const p = row.profile;
          if (!p?.id) return null;
          return {
            user_id: p.id,
            display_name: p.display_name || 'Profil',
            avatar_url: p.avatar_url || null,
            cover_url: p.cover_url || null,
            city: p.city || null,
            bio: p.bio || null,
            // Aggregate community stats are intentionally omitted here: the
            // security-invoker view scans all visible events and can exceed the
            // authenticated statement timeout. The profile detail remains the
            // source of truth for those counters.
            events_created_count: 0,
            followers_count: 0,
            following_count: 0,
          } as CommunityMember;
        })
        .filter(Boolean) as CommunityMember[];

      setCreatorFavorites(creators);
    } catch (error) {
      console.warn('load favorites error', error);
      Alert.alert('Erreur', 'Impossible de charger vos favoris pour le moment.');
    } finally {
      setInitialLoading(false);
      setLoadingFavorites(false);
      setRefreshing(false);
    }
  }, [profile?.id, replaceFavorites, session, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites]),
  );

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const queryValue = query.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    const searched = favorites.filter((event) => {
      if (!queryValue) return true;
      const haystack = [
        event.title,
        event.category,
        event.city,
        event.address,
        event.creator?.display_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(queryValue);
    });

    const temporal = filterFavoriteEvents(searched, timeFilter, new Date(nowMs));

    if (favoriteSort === 'distance' && userLocation) {
      return sortEvents(temporal, 'distance', userLocation, 'asc');
    }
    if (favoriteSort === 'date_desc') {
      return sortEvents(temporal, 'date', null, 'desc');
    }
    // Date ascending is also the safe fallback while location is unavailable.
    return sortEvents(temporal, 'date', null, 'asc');
  }, [favoriteSort, favorites, nowMs, queryValue, timeFilter, userLocation]);

  const filteredCreators = useMemo(() => {
    return creatorFavorites.filter((creator) => {
      if (!queryValue) return true;
      const haystack = [creator.display_name, creator.city, creator.bio].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(queryValue);
    });
  }, [creatorFavorites, queryValue]);

  const favoritesSet = useMemo(() => new Set(favorites.map((event) => event.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadFavorites();
  };

  const handleChooseSort = () => {
    Alert.alert('Trier les favoris', undefined, [
      {
        text: 'Distance croissante',
        onPress: () => setFavoriteSort('distance'),
      },
      {
        text: 'Date la plus proche',
        onPress: () => setFavoriteSort('date_asc'),
      },
      {
        text: 'Date la plus lointaine',
        onPress: () => setFavoriteSort('date_desc'),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleToggleHeart = async (event: EventWithCreator) => {
    if (!profile?.id) return;
    const before = {
      isLiked: likesSet.has(event.id),
      isFavorite: favoritesSet.has(event.id),
    };
    try {
      const after = await toggleEventHeart(profile.id, event, before);
      syncHeartStores(event, before, after, { toggleLike, toggleFavorite });
    } catch (error) {
      console.warn('favorites screen toggle heart error', error);
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    }
  };

  const handleUnfollowCreator = async (creatorId: string) => {
    try {
      await CommunityService.unfollow(creatorId);
      setCreatorFavorites((prev) => prev.filter((creator) => creator.user_id !== creatorId));
    } catch (error) {
      console.warn('favorites screen unfollow creator error', error);
      Alert.alert('Erreur', 'Impossible de ne plus suivre ce créateur pour le moment.');
    }
  };

  const handleClearEventFavorites = async () => {
    if (!profile?.id) return;

    Alert.alert('Vider les favoris', 'Supprimer tous vos événements favoris ?', [
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

  const handleClearFollows = async () => {
    const followerId = user?.id || session?.user?.id || profile?.id;
    if (!followerId) return;

    Alert.alert('Vider les suivis', 'Ne plus suivre tous ces créateurs ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('follows').delete().eq('follower', followerId);
            if (error) throw error;
            setCreatorFavorites([]);
          } catch (clearError) {
            console.warn('clear follows error', clearError);
            Alert.alert('Erreur', 'Impossible de vider les suivis pour le moment.');
          }
        },
      },
    ]);
  };

  if (isLoading || initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <AppBackground />
        <DiscoveryLoadingState
          icon={Heart}
          title="Nous préparons vos favoris"
          subtitle="Encore un instant, vos pépites arrivent…"
        />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centeredContainer}>
        <AppBackground />
        <Text style={styles.emptyTitle}>Connexion requise</Text>
        <Text style={styles.emptySubtitle}>Connectez-vous pour accéder à vos favoris.</Text>
      </View>
    );
  }

  const eventsCountLabel = `${filteredEvents.length} FAVORI${filteredEvents.length > 1 ? 'S' : ''} AFFICHÉ${filteredEvents.length > 1 ? 'S' : ''}`;
  const creatorsCountLabel = `${filteredCreators.length} PROFILS SUIVIS`;
  const sortLabel = favoriteSort === 'distance'
    ? userLocation
      ? 'Distance'
      : locationLoading
        ? 'Localisation…'
        : 'Distance indisponible'
    : favoriteSort === 'date_asc'
      ? 'Date proche'
      : 'Date lointaine';

  const eventEmptyState = (() => {
    if (favorites.length === 0) {
      return {
        title: 'Aucun événement favori',
        subtitle: 'Ajoutez des événements en favoris pour les retrouver ici.',
        ctaLabel: 'Explorer les événements',
        onCtaPress: () => router.push('/(tabs)' as any),
      };
    }
    if (queryValue) {
      return {
        title: 'Aucun favori correspondant',
        subtitle: 'Essayez une autre recherche ou réinitialisez les filtres.',
        ctaLabel: 'Réinitialiser',
        onCtaPress: () => {
          setQuery('');
          setTimeFilter(DEFAULT_FAVORITE_TIME_FILTER);
        },
      };
    }
    if (timeFilter === 'active') {
      return {
        title: 'Aucun favori en cours ou à venir',
        subtitle: 'Vos anciens favoris restent disponibles dans le filtre « Passés ».',
        ctaLabel: 'Voir les favoris passés',
        onCtaPress: () => setTimeFilter('past'),
      };
    }
    return {
      title: 'Aucun favori dans cette période',
      subtitle: 'Choisissez une autre période pour retrouver vos événements.',
      ctaLabel: 'Voir en cours & à venir',
      onCtaPress: () => setTimeFilter(DEFAULT_FAVORITE_TIME_FILTER),
    };
  })();

  return (
    <View style={styles.container}>
      <AppBackground />

      <View style={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mes Favoris</Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.85}
          >
            <Bell size={18} color={colors.brand.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search size={20} color={colors.brand.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher vos pépites enregistrées..."
            placeholderTextColor={colors.brand.textSecondary}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'events' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('events')}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, activeTab === 'events' && styles.segmentTextActive]}>Événements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'creators' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('creators')}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, activeTab === 'creators' && styles.segmentTextActive]}>Suivis</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'events' ? (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              accessibilityRole="radiogroup"
            >
              {TIME_FILTERS.map((option) => {
                const active = timeFilter === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setTimeFilter(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {favoriteSort === 'distance' && !userLocation && !locationLoading ? (
              <Text style={styles.locationHint}>
                Activez la localisation pour classer les favoris par distance. Tri par date appliqué temporairement.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{activeTab === 'events' ? eventsCountLabel : creatorsCountLabel}</Text>
          {activeTab === 'events' ? (
            <View style={styles.listHeaderActions}>
              <TouchableOpacity
                style={styles.sortButton}
                onPress={handleChooseSort}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Tri actuel : ${sortLabel}`}
              >
                <MapPin size={14} color={colors.brand.secondary} />
                <Text style={styles.sortText}>{sortLabel}</Text>
                <ChevronDown
                  size={14}
                  color={colors.brand.secondary}
                />
              </TouchableOpacity>
              {loadingFavorites && !refreshing ? (
                <ActivityIndicator size="small" color={colors.brand.secondary} />
              ) : null}
              {filteredEvents.length > 0 ? (
                <TouchableOpacity style={styles.sortButton} onPress={handleClearEventFavorites} activeOpacity={0.85}>
                  <Text style={styles.sortText}>Vider</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : filteredCreators.length > 0 ? (
            <TouchableOpacity style={styles.sortButton} onPress={handleClearFollows} activeOpacity={0.85}>
              <Text style={styles.sortText}>Vider les suivis</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {activeTab === 'events' ? (
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.secondary} />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon={Heart}
                title={eventEmptyState.title}
                subtitle={eventEmptyState.subtitle}
                ctaLabel={eventEmptyState.ctaLabel}
                onCtaPress={eventEmptyState.onCtaPress}
              />
            }
            renderItem={({ item }) => (
              <EventCard
                event={item}
                variant="favorite"
                isFavorite={favoritesSet.has(item.id) || likesSet.has(item.id)}
                isLiked={likesSet.has(item.id) || favoritesSet.has(item.id)}
                isParticipating={Boolean(item.is_interested)}
                onHeartPress={() => handleToggleHeart(item)}
                onPress={() => router.push(`/events/${item.id}` as any)}
                onPrimaryAction={() => setNavEvent(item)}
                onSecondaryAction={() => router.push(`/events/${item.id}` as any)}
                onNavigate={() => setNavEvent(item)}
                distanceKm={
                  userLocation
                    ? calculateDistanceKm(
                        userLocation.latitude,
                        userLocation.longitude,
                        item.latitude,
                        item.longitude,
                      )
                    : undefined
                }
                style={styles.eventCard}
              />
            )}
          />
        ) : (
          <FlatList
            data={filteredCreators}
            keyExtractor={(item) => item.user_id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.secondary} />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon={Compass}
                title="Aucun profil suivi"
                subtitle="Suivez des créateurs depuis la communauté pour les retrouver ici."
                ctaLabel="Découvrir la communauté"
                onCtaPress={() => router.push('/(tabs)/community' as any)}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.creatorCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/community/${item.user_id}` as any)}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{(item.display_name || '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.creatorBody}>
                  <Text style={styles.creatorName} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text style={styles.creatorMeta} numberOfLines={1}>
                    {[item.city, item.bio].filter(Boolean).join(' · ') || 'Profil suivi'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.favoriteFabSmall}
                  activeOpacity={0.85}
                  onPress={() => handleUnfollowCreator(item.user_id)}
                >
                  <Heart size={18} color={colors.brand.secondary} fill={colors.brand.secondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

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
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h2,
    color: colors.brand.text,
    fontWeight: '800',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  searchBox: {
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  segmentButton: {
    flex: 1,
    borderRadius: borderRadius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.brand.secondary,
  },
  segmentText: {
    ...typography.h6,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#06242c',
  },
  filterRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  filterChip: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    borderColor: colors.brand.secondary,
    backgroundColor: 'rgba(124, 181, 24, 0.16)',
  },
  filterChipText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.brand.secondary,
  },
  locationHint: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  listHeader: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listTitle: {
    ...typography.h6,
    flex: 1,
    color: '#9eb0c4',
    letterSpacing: 1,
    fontWeight: '800',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    ...typography.caption,
    color: colors.brand.secondary,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  eventCard: {
    marginBottom: 0,
  },
  creatorCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.full,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarFallbackText: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '800',
  },
  creatorBody: {
    flex: 1,
    gap: 4,
  },
  creatorName: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '800',
  },
  creatorMeta: {
    ...typography.subtitle,
    color: colors.brand.textSecondary,
  },
  favoriteFabSmall: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 22, 28, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.h5,
    color: colors.brand.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
});
