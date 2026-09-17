import type { EventWithCreator } from '../types/database';
import { extractEventCoords } from './event-coords';

export type FavoriteMapPin = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
};

export function buildFavoriteMapPins(events: EventWithCreator[]): FavoriteMapPin[] {
  const pins: FavoriteMapPin[] = [];
  for (const event of events) {
    const coords = extractEventCoords(event);
    if (!coords) continue;
    pins.push({
      id: event.id,
      title: event.title?.trim() || 'Événement',
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  }
  return pins;
}

export function boundsForFavoritePins(
  pins: FavoriteMapPin[],
): { ne: [number, number]; sw: [number, number] } | null {
  if (!pins.length) return null;

  let minLon = pins[0].longitude;
  let maxLon = pins[0].longitude;
  let minLat = pins[0].latitude;
  let maxLat = pins[0].latitude;

  for (const pin of pins) {
    minLon = Math.min(minLon, pin.longitude);
    maxLon = Math.max(maxLon, pin.longitude);
    minLat = Math.min(minLat, pin.latitude);
    maxLat = Math.max(maxLat, pin.latitude);
  }

  const lonPad = minLon === maxLon ? 0.02 : 0;
  const latPad = minLat === maxLat ? 0.02 : 0;

  return {
    ne: [maxLon + lonPad, maxLat + latPad],
    sw: [minLon - lonPad, minLat - latPad],
  };
}
