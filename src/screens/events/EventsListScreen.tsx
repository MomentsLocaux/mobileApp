import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { EventCard, EventFilters } from '../../components/events';
import { EventsService } from '../../services/events.service';
import { SocialService } from '../../services/social.service';
import { useAuth } from '../../hooks';
import { useLocationStore, useFilterStore } from '../../store';
import { filterEvents } from '../../utils/filter-events';
import { sortEvents } from '../../utils/sort-events';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import type { EventWithCreator } from '../../types/database';

export default function EventsListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentLocation } = useLocationStore();
  const { filters, focusedIds, setFilters, resetFilters, getActiveFilterCount } = useFilterStore();

  const [allEvents, setAllEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await EventsService.listEvents({}, 'date');
      setAllEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredAndSortedEvents = useMemo(() => {
    const filtered = filterEvents(allEvents, filters, focusedIds);
    return sortEvents(filtered, filters.sortBy || 'date', userLocation);
  }, [allEvents, filters, focusedIds, userLocation]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleEventPress = (eventId: string) => {
    router.push(`/events/${eventId}`);
  };

  const handleFavoritePress = async (eventId: string) => {
    if (!profile) return;

    await SocialService.toggleFavorite(profile.id, eventId);

    setAllEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, is_favorited: !event.is_favorited }
          : event
      )
    );
  };

  const renderEventCard = ({ item }: { item: EventWithCreator }) => (
    <EventCard
      event={item}
      onPress={() => handleEventPress(item.id)}
      onFavoritePress={() => handleFavoritePress(item.id)}
    />
  );

  const activeFiltersCount = getActiveFilterCount();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Chargement des événements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <EventFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={resetFilters}
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
            tintColor={colors.primary[600]}
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

      {profile?.role === 'createur' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/events/create' as any)}
        >
          <Plus size={24} color={colors.neutral[0]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
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
  restrictionBanner: {
    backgroundColor: colors.warning[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  restrictionText: {
    ...typography.bodySmall,
    color: colors.warning[700],
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
    color: colors.neutral[600],
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
