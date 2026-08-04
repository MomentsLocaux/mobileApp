import type { EventWithCreator } from '@/types/database';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';
import type { ProposalPreferences } from './proposal.types';
import { filterProposalPool } from './proposal-filtering';

export { distanceBetweenKm, PROPOSAL_POOL_SIZE } from './proposal-filtering';
const PROPOSAL_FETCH_LIMIT = 300;

export async function fetchProposalPool(params: {
  preferences: ProposalPreferences;
  categoryValues: string[];
  excludedIds?: Iterable<string>;
}): Promise<EventWithCreator[]> {
  const { preferences, categoryValues, excludedIds } = params;
  if (!preferences.anchor) return [];

  const bounds = getBoundsFromRadiusKm(
    preferences.anchor.latitude,
    preferences.anchor.longitude,
    preferences.radiusKm,
  );
  const viewport = await listMapViewportForMap(
    { ...bounds, limit: PROPOSAL_FETCH_LIMIT },
    'current',
  );

  return filterProposalPool({
    events: viewport.events || [],
    preferences,
    categoryValues,
    excludedIds,
  });
}
