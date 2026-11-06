import { haversineKm } from './duplicate-candidates';
import { extractEventCoords, type EventCoords } from './event-coords';

export type MapCardSwipeDirection = 'left' | 'right';

type NeighborCandidate = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  location?:
    | {
        type?: string;
        coordinates?: [number, number];
      }
    | string
    | null;
};

/**
 * Direction is the side of the neighbor on a north-up map.
 * Left is west, right is east. The card itself travels the other way:
 * a right-hand event is revealed by moving the current card to the left.
 */
export function nearestEventForCardSwipe<T extends NeighborCandidate>(
  current: T,
  candidates: readonly T[],
  direction: MapCardSwipeDirection,
): T | null {
  const origin = extractEventCoords(current);
  if (!origin) return null;

  const wantEast = direction === 'right';
  let best: { event: T; distance: number } | null = null;

  for (const candidate of candidates) {
    if (candidate.id === current.id) continue;
    const coords = extractEventCoords(candidate);
    if (!coords) continue;
    const east = eastOffset(origin, coords);
    if (wantEast ? east <= 0 : east >= 0) continue;

    const distance = haversineKm(
      origin.latitude,
      origin.longitude,
      coords.latitude,
      coords.longitude,
    );
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && candidate.id < best.event.id)
    ) {
      best = { event: candidate, distance };
    }
  }

  return best?.event ?? null;
}

/** Positive when the target sits east of the origin. */
function eastOffset(origin: EventCoords, target: EventCoords): number {
  const meanLat = ((origin.latitude + target.latitude) / 2) * (Math.PI / 180);
  return (target.longitude - origin.longitude) * Math.cos(meanLat);
}
