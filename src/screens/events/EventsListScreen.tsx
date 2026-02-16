import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Flame, Clock, MapPin } from 'lucide-react-native';
import { EventCard, EventFilters } from '../../components/events';
import { AppBackground } from '@/components/ui';
import { SocialService } from '../../services/social.service';
import { useAuth } from '../../hooks';
import { useLocationStore, useFilterStore } from '../../store';
import { filterEvents } from '../../utils/filter-events';
import { sortEvents } from '../../utils/sort-events';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import type { EventWithCreator } from '../../types/database';
import { useEvents } from '@/hooks/useEvents';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useLikesStore } from '@/store/likesStore';

export default function EventsListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentLocation } = useLocationStore();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { likedEventIds, toggleLike } = useLikesStore();
  const { filters, focusedIds, setFilters, resetFilters, getActiveFilterCount } = useFilterStore();
  const { events: fetchedEvents, loading: loadingEvents, reload } = useEvents({ limit: 100 });

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'nearby' | 'soon' | 'popular' | null>(null);

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const filteredAndSortedEvents = useMemo(() => {
    const base = filterEvents(fetchedEvents || [], filters, focusedIds).filter((event) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        event.title.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        event.address?.toLowerCase().includes(q)
      );
    });

    let quickFiltered = base;
    const now = new Date();
    if (quickFilter === 'nearby' && userLocation) {
      quickFiltered = base.filter((event) => {
        const dx = event.latitude - userLocation.latitude;
        const dy = event.longitude - userLocation.longitude;
        const dist2 = dx * dx + dy * dy;
        return dist2 < 0.05; // simplifié: ~ rayon local
      });
    }
    if (quickFilter === 'soon') {
      quickFiltered = base.filter((event) => event.starts_at && new Date(event.starts_at) > now);
    }
    if (quickFilter === 'popular') {
      quickFiltered = base.sort((a, b) => (b.interests_count || 0) - (a.interests_count || 0));
    }

    return sortEvents(quickFiltered, filters.sortBy || 'date', userLocation);
  }, [fetchedEvents, filters, focusedIds, search, quickFilter, userLocation]);

  const handleRefresh = () => {
    setRefreshing(true);
    reload();
  };

  const handleEventPress = (eventId: string) => {
    router.push(`/events/${eventId}`);
  };

  const favoritesSet = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const likesSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);

  const handleLikePress = async (eventId: string) => {
    if (!profile) return;
    const nowLiked = await SocialService.like(profile.id, eventId);
    const wasLiked = likesSet.has(eventId);
    if (nowLiked !== wasLiked) {
      toggleLike(eventId);
    }
  };

  const handleFavoritePress = async (event: EventWithCreator) => {
    if (!profile) return;
    const nowFavorited = await SocialService.toggleFavorite(profile.id, event.id);
    const wasFavorited = favoritesSet.has(event.id);
    if (nowFavorited !== wasFavorited) {
      toggleFavorite(event);
    }
  };

  const renderEventCard = ({ item }: { item: EventWithCreator }) => (
    <EventCard
      event={item}
      onPress={() => handleEventPress(item.id)}
      onLikePress={() => handleLikePress(item.id)}
      isLiked={likesSet.has(item.id)}
      onFavoritePress={() => handleFavoritePress(item)}
      isFavorited={favoritesSet.has(item.id)}
    />
  );

  const activeFiltersCount = getActiveFilterCount();

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
      <AppBackground />
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.brand.textSecondary} />
          <TextInput
            placeholder="Rechercher un événement"
            placeholderTextColor={colors.brand.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.quickFilters}>
        <QuickChip
          label="À proximité"
          active={quickFilter === 'nearby'}
          icon={<MapPin size={14} color={quickFilter === 'nearby' ? colors.brand.primary : colors.brand.textSecondary} />}
          onPress={() => setQuickFilter(quickFilter === 'nearby' ? null : 'nearby')}
        />
        <QuickChip
          label="Bientôt"
          active={quickFilter === 'soon'}
          icon={<Clock size={14} color={quickFilter === 'soon' ? colors.brand.primary : colors.brand.textSecondary} />}
          onPress={() => setQuickFilter(quickFilter === 'soon' ? null : 'soon')}
        />
        <QuickChip
          label="Populaire"
          active={quickFilter === 'popular'}
          icon={<Flame size={14} color={quickFilter === 'popular' ? colors.brand.primary : colors.brand.textSecondary} />}
          onPress={() => setQuickFilter(quickFilter === 'popular' ? null : 'popular')}
        />
      </View>

      <EventFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={() => {
          resetFilters();
          setQuickFilter(null);
        }}
        activeFiltersCount={activeFiltersCount}
      />

      {focusedIds && focusedIds.length > 0 && (
        <View style={styles.restrictionBanner}>
          <Text style={styles.restrictionText}>
            Affichage restreint à {focusedIds.length} événement(s) sélectionné(s)
          </Text>
        </View>
      )}

      <FlatList
        data={filteredAndSortedEvents}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeFiltersCount > 0 || focusedIds
                ? 'Aucun événement ne correspond aux filtres'
                : 'Aucun événement trouvé'}
            </Text>
          </View>
        }
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
    color: colors.brand.textSecondary,
    marginTop: spacing.md,
  },
  restrictionBanner: {
    backgroundColor: colors.warning[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  restrictionText: {
    ...typography.bodySmall,
    color: colors.warning[400],
    textAlign: 'center',
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: 'center',
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.brand.text,
  },
  quickFilters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  quickChipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  quickChipText: {
    ...typography.bodySmall,
    color: colors.brand.textSecondary,
    fontWeight: '600',
  },
});

function QuickChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.quickChip, active && styles.quickChipActive]}
      activeOpacity={0.8}
    >
      {icon}
      <Text style={styles.quickChipText}>{label}</Text>
    </TouchableOpacity>
  );
}
