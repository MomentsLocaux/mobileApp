import { Image } from 'react-native';
import type { EventWithCreator } from '@/types/database';
import { EventsService } from '@/services/events.service';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import { getEventImageUrls } from '@/utils/event-card-display';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';
import type { ProposalPreferences } from './proposal.types';
import {
  filterProposalPool,
  resolveProposalCandidateRequest,
  resolveProposalViewportRequest,
  selectProposalDeck,
} from './proposal-filtering';

export { distanceBetweenKm, PROPOSAL_FETCH_LIMIT, PROPOSAL_POOL_SIZE } from './proposal-filtering';

const PREFETCH_WAIT_MS = 1500;

export function prefetchProposalCovers(
  events: EventWithCreator[],
  limit = events.length,
): Promise<boolean[]> {
  return Promise.all(
    events.slice(0, limit).map((event) => {
      const uri = getEventImageUrls(event)[0];
      if (!uri) return Promise.resolve(false);
      return Image.prefetch(uri).catch(() => false);
    }),
  );
}

export async function waitForProposalCoverPrefetch(
  events: EventWithCreator[],
  readyCount = 3,
): Promise<void> {
  await Promise.race([
    prefetchProposalCovers(events, readyCount),
    new Promise<void>((resolve) => {
      setTimeout(resolve, PREFETCH_WAIT_MS);
    }),
  ]);
  void prefetchProposalCovers(events.slice(readyCount));
}

function isMissingProposalRpc(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (message.includes('function') && message.includes('does not exist')) ||
    message.includes('could not find the function')
  );
}

async function fetchProposalPoolViaViewport(
  preferences: ProposalPreferences,
): Promise<EventWithCreator[]> {
  if (!preferences.anchor) return [];

  const request = resolveProposalViewportRequest(preferences);
  if (!request.dateRange) return [];

  const bounds = getBoundsFromRadiusKm(
    preferences.anchor.latitude,
    preferences.anchor.longitude,
    preferences.radiusKm,
  );
  const viewport = await listMapViewportForMap(
    { ...bounds, limit: request.limit },
    request.timeScope,
    { mergeUpcomingForDatePreset: request.mergeUpcoming },
  );

  return viewport.events || [];
}

export async function fetchProposalPool(params: {
  preferences: ProposalPreferences;
  categoryValues: string[];
  excludedIds?: Iterable<string>;
}): Promise<EventWithCreator[]> {
  const { preferences, categoryValues, excludedIds } = params;
  const request = resolveProposalCandidateRequest({ preferences, excludedIds });
  if (!request) return [];

  let events: EventWithCreator[] = [];
  try {
    events = await EventsService.listProposalCandidates(request);
  } catch (error) {
    if (!isMissingProposalRpc(error)) throw error;
    events = await fetchProposalPoolViaViewport(preferences);
  }

  return selectProposalDeck(
    filterProposalPool({
      events,
      preferences,
      categoryValues,
      excludedIds,
    }),
  );
}
