import type { Feature, FeatureCollection } from 'geojson';
import type { EventWithCreator } from '@/types/database';
import { resolveEventMarkerIconFromEvent } from '@/constants/category-visuals';

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
