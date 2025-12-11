import type { EventWithCreator } from '../types/database';
import type { SortOption } from '../types/filters';

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function sortEvents(
  events: EventWithCreator[],
  sortBy: SortOption,
  userLocation?: { latitude: number; longitude: number } | null
): EventWithCreator[] {
  const sorted = [...events];

  const extractCoords = (event: EventWithCreator) => {
    if (Array.isArray((event as any)?.location?.coordinates)) {
      const [lon, lat] = (event as any).location.coordinates as [number, number];
      return { lat, lon };
    }

    if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      return { lat: event.latitude, lon: event.longitude };
    }

    return null;
  };

  switch (sortBy) {
    case 'distance':
      if (!userLocation) {
        console.warn('Cannot sort by distance without user location');
        return sorted;
      }
      sorted.sort((a, b) => {
        const aCoords = extractCoords(a);
        const bCoords = extractCoords(b);

        if (!aCoords && !bCoords) return 0;
        if (!aCoords) return 1;
        if (!bCoords) return -1;

        const distA = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          aCoords.lat,
          aCoords.lon
        );
        const distB = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          bCoords.lat,
          bCoords.lon
        );
        return distA - distB;
      });
      break;

    case 'popularity':
      sorted.sort((a, b) => {
        const popA = a.interests_count || 0;
        const popB = b.interests_count || 0;
        return popB - popA;
      });
      break;

    case 'date':
      sorted.sort((a, b) => {
        const dateA = new Date(a.starts_at).getTime();
        const dateB = new Date(b.starts_at).getTime();
        return dateA - dateB;
      });
      break;
  }

  return sorted;
}

export function getDistanceText(
  eventLat: number,
  eventLon: number,
  userLocation?: { latitude: number; longitude: number } | null
): string | null {
  if (!userLocation) return null;

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    eventLat,
    eventLon
  );

  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
}
