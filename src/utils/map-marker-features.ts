import type { Feature, FeatureCollection } from 'geojson';
import type { EventWithCreator } from '@/types/database';
import type { MapBounds } from '@/types/map-events';
import { resolveEventMarkerIconFromEvent } from '@/constants/category-visuals';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';

export function extractEventCoordinates(
  event: EventWithCreator
): { latitude: number; longitude: number } | null {
  if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
    if (event.latitude === 0 && event.longitude === 0) return null;
    return { latitude: event.latitude, longitude: event.longitude };
  }

  const coordinates = (event as { location?: { coordinates?: [number, number] } }).location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const [lon, lat] = coordinates;
    if (typeof lat === 'number' && typeof lon === 'number') {
      if (lat === 0 && lon === 0) return null;
      return { latitude: lat, longitude: lon };
    }
  }

  return null;
}

export function buildMapMarkerFeatures(events: EventWithCreator[]): Feature[] {
  return events
    .map((event) => {
      const coords = extractEventCoordinates(event);
      if (!coords) return null;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [coords.longitude, coords.latitude],
        },
        properties: {
          id: String(event.id),
          icon: resolveEventMarkerIconFromEvent(event),
        },
      } as Feature;
    })
    .filter((feature): feature is Feature => feature !== null);
}

export function buildMapMarkerCollection(events: EventWithCreator[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: buildMapMarkerFeatures(events),
  };
}

export function filterMappableEvents(events: EventWithCreator[]): EventWithCreator[] {
  return events.filter((event) => extractEventCoordinates(event) !== null);
}

/** Bounds for an in-memory result set transferred from Home to the map. */
export function getMapBoundsForEvents(
  events: EventWithCreator[],
  minimumRadiusKm = 3
): MapBounds | null {
  const coordinates = events
    .map(extractEventCoordinates)
    .filter((value): value is { latitude: number; longitude: number } => value !== null);
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) {
    return getBoundsFromRadiusKm(
      coordinates[0].latitude,
      coordinates[0].longitude,
      minimumRadiusKm
    );
  }

  const latitudes = coordinates.map((item) => item.latitude);
  const longitudes = coordinates.map((item) => item.longitude);
  const bounds: MapBounds = {
    ne: [Math.max(...longitudes), Math.max(...latitudes)],
    sw: [Math.min(...longitudes), Math.min(...latitudes)],
  };

  const hasUsefulWidth = Math.abs(bounds.ne[0] - bounds.sw[0]) > 1e-4;
  const hasUsefulHeight = Math.abs(bounds.ne[1] - bounds.sw[1]) > 1e-4;
  if (hasUsefulWidth && hasUsefulHeight) return bounds;

  const center = {
    latitude: (bounds.ne[1] + bounds.sw[1]) / 2,
    longitude: (bounds.ne[0] + bounds.sw[0]) / 2,
  };
  const padding = getBoundsFromRadiusKm(center.latitude, center.longitude, minimumRadiusKm);
  return {
    ne: [Math.max(bounds.ne[0], padding.ne[0]), Math.max(bounds.ne[1], padding.ne[1])],
    sw: [Math.min(bounds.sw[0], padding.sw[0]), Math.min(bounds.sw[1], padding.sw[1])],
  };
}
