import type { EventWithCreator } from '@/types/database';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { corridorHalfWidthKm, expandedBoundsOf } from './roadtrip-geo';
import type { RoadtripLeg } from './roadtrip.types';

const FETCH_LIMIT = 300;

/**
 * Pool of raw events around the whole route: one viewport query on the route
 * bbox expanded by the corridor width. The precise corridor / temporal
 * filtering happens in `computeRoadtripCandidates` (and later server-side in
 * the `list_roadtrip_event_candidates` RPC).
 */
export async function fetchRoadtripEventPool(params: {
  legs: RoadtripLeg[];
  detourBudgetMinutes: number;
}): Promise<EventWithCreator[]> {
  const { legs, detourBudgetMinutes } = params;
  const allPositions = legs.flatMap((leg) => leg.geometry);
  const bounds = expandedBoundsOf(allPositions, corridorHalfWidthKm(detourBudgetMinutes));
  if (!bounds) return [];

  const viewport = await listMapViewportForMap(
    { ne: bounds.ne, sw: bounds.sw, limit: FETCH_LIMIT },
    'current',
    { mergeUpcomingForDatePreset: true },
  );
  return viewport.events || [];
}
