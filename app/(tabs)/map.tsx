import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { FilterTray, QuickPreview, ClusterPreview, MapWrapper } from '../../src/components/map';
import { EventsService } from '../../src/services/events.service';
import { useAuth } from '../../src/hooks';
import { useLocationStore, useFilterStore } from '../../src/store';
import { filterEvents } from '../../src/utils/filter-events';
import { sortEvents } from '../../src/utils/sort-events';
import { colors, spacing, borderRadius } from '../../src/constants/theme';
import type { EventWithCreator } from '../../src/types/database';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const PARIS_COORDS = { latitude: 48.8566, longitude: 2.3522 };

export default function MapScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentLocation } = useLocationStore();
  const { filters, focusedIds, setFilters, setFocusedIds, resetFilters, getActiveFilterCount } = useFilterStore();

  const [allEvents, setAllEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventWithCreator | null>(null);
  const [clusterEvents, setClusterEvents] = useState<EventWithCreator[] | null>(null);
  const [zoom, setZoom] = useState(12);

  const userLocation = useMemo(() => {
    if (!currentLocation) return null;
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  }, [currentLocation]);

  const mapCenter = {
    latitude: currentLocation?.coords.latitude || PARIS_COORDS.latitude,
    longitude: currentLocation?.coords.longitude || PARIS_COORDS.longitude,
    zoom: 12,
  };

  const loadEvents = useCallback(async () => {
    try {
      const data = await EventsService.listEvents();
      setAllEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Erreur', 'Impossible de charger les événements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredAndSortedEvents = useMemo(() => {
    const filtered = filterEvents(allEvents, filters, focusedIds);
    return sortEvents(filtered, filters.sortBy || 'date', userLocation);
  }, [allEvents, filters, focusedIds, userLocation]);

  const handleMarkerPress = (event: EventWithCreator) => {
    setSelectedEvent(event);
    setClusterEvents(null);
  };

  const handleClusterPress = (events: EventWithCreator[]) => {
    setClusterEvents(events);
    setSelectedEvent(null);
    const eventIds = events.map(e => e.id);
    setFocusedIds(eventIds);
  };

  const handleViewDetails = () => {
    if (selectedEvent) {
      router.push(`/events/${selectedEvent.id}` as any);
    }
  };

  const handleResetFilters = () => {
    resetFilters();
  };

  const activeFiltersCount = getActiveFilterCount();
  const hasUserLocation = !!currentLocation;

  if (Platform.OS === 'web' && (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('placeholder'))) {
    return (
      <View style={styles.container}>
        <View style={styles.fallback}>
          <MapPin size={48} color={colors.neutral[400]} />
          <Text style={styles.fallbackText}>
            Token Mapbox manquant. Configurez EXPO_PUBLIC_MAPBOX_TOKEN dans .env
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Chargement de la carte...</Text>
        </View>
      </View>
    );
  }

  if (filteredAndSortedEvents.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.topOverlay}>
          <FilterTray
            filters={filters}
            onFiltersChange={setFilters}
            onReset={handleResetFilters}
            activeFiltersCount={activeFiltersCount}
            hasUserLocation={hasUserLocation}
          />
        </View>
        <View style={styles.fallback}>
          <MapPin size={48} color={colors.neutral[400]} />
          <Text style={styles.fallbackText}>
            {activeFiltersCount > 0
              ? 'Aucun événement ne correspond aux filtres'
              : 'Aucun événement à afficher sur la carte'}
          </Text>
          {activeFiltersCount === 0 && (
            <Text style={styles.fallbackSubtext}>
              Créez votre premier événement pour le voir apparaître ici
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapWrapper
        events={filteredAndSortedEvents}
        initialRegion={mapCenter}
        onMarkerPress={handleMarkerPress}
        onClusterPress={handleClusterPress}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      <View style={styles.topOverlay}>
        <FilterTray
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
          activeFiltersCount={activeFiltersCount}
          hasUserLocation={hasUserLocation}
        />
      </View>

      {selectedEvent && (
        <View style={styles.bottomOverlay}>
          <QuickPreview
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onViewDetails={handleViewDetails}
          />
        </View>
      )}

      {clusterEvents && clusterEvents.length > 0 && (
        <View style={styles.bottomOverlay}>
          <ClusterPreview
            events={clusterEvents}
            onClose={() => {
              setClusterEvents(null);
              setFocusedIds(null);
            }}
            onViewInList={() => {
              setClusterEvents(null);
              router.push('/(tabs)' as any);
            }}
            onSelectEvent={(eventId) => {
              const event = filteredAndSortedEvents.find((e) => e.id === eventId);
              if (event) {
                setClusterEvents(null);
                setFocusedIds(null);
                setSelectedEvent(event);
              }
            }}
          />
        </View>
      )}

      {Platform.OS === 'web' && (
        <View style={styles.zoomControl}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.min(18, zoom + 1))}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{Math.round(zoom)}</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoom(Math.max(2, zoom - 1))}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  fallbackText: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.neutral[600],
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackSubtext: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.neutral[500],
    fontSize: 14,
  },
  topOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    maxWidth: 400,
    zIndex: 10,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  zoomControl: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 10,
  },
  zoomButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
  },
  zoomButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  zoomLevel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
    paddingVertical: spacing.xs,
  },
});
