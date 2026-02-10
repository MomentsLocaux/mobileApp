import type { EventWithCreator } from '../types/database';
import type { SortOption, SortOrder } from '../types/filters';

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
  userLocation?: { latitude: number; longitude: number } | null,
  sortOrder?: SortOrder
): EventWithCreator[] {
  const sorted = [...events];
  const order = sortOrder ?? (sortBy === 'created' ? 'desc' : 'asc');
  const getTimestamp = (value?: string | null) => {
    const ts = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(ts) ? 0 : ts;
  };

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

  const scoreTriage = (event: EventWithCreator) => {
    const now = Date.now();
    const startsAt = new Date(event.starts_at).getTime();
    const endsAt = event.ends_at ? new Date(event.ends_at).getTime() : NaN;

    let timeScore = 0.2;
    if (!isNaN(startsAt)) {
      if (!isNaN(endsAt) && now >= startsAt && now <= endsAt) {
        timeScore = 1.2;
      } else {
        const diffHours = (startsAt - now) / 3600000;
        if (diffHours >= 0) {
          timeScore = 1 / (1 + diffHours / 24);
        } else {
          timeScore = 0.3 / (1 + Math.abs(diffHours) / 24);
        }
      }
    }

    let distanceScore = 0.5;
    if (userLocation) {
      const coords = extractCoords(event);
      if (coords) {
        const dist = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          coords.lat,
          coords.lon
        );
        distanceScore = 1 / (1 + dist);
      }
    }

    const popularityRaw =
      (event.interests_count || 0) +
      (event.likes_count || 0) * 0.7 +
      (event.comments_count || 0) * 0.5 +
      (event.checkins_count || 0) * 0.8;
    const popularityScore = Math.log1p(popularityRaw);

    const qualityScore =
      (event.cover_url ? 0.5 : 0) +
      (event.venue_name ? 0.3 : 0) +
      (event.description && event.description.trim().length > 40 ? 0.2 : 0);

    return 0.35 * timeScore + 0.25 * distanceScore + 0.25 * popularityScore + 0.15 * qualityScore;
  };

  switch (sortBy) {
    case 'triage':
      sorted.sort((a, b) => scoreTriage(b) - scoreTriage(a));
      break;
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
        const dateA = getTimestamp(a.starts_at);
        const dateB = getTimestamp(b.starts_at);
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      });
      break;
    case 'endDate':
      sorted.sort((a, b) => {
        const dateA = getTimestamp(a.ends_at) || getTimestamp(a.starts_at);
        const dateB = getTimestamp(b.ends_at) || getTimestamp(b.starts_at);
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      });
      break;
    case 'created':
      sorted.sort((a, b) => {
        const dateA = getTimestamp(a.created_at);
        const dateB = getTimestamp(b.created_at);
        return order === 'asc' ? dateA - dateB : dateB - dateA;
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
