import { EventsService } from '@/services/events.service';
import {
  mergeFeatureCollections,
  type EventMapFeatureCollection,
} from '@/types/map-events';
import type { EventWithCreator } from '@/types/database';
import type { FeatureCollection } from 'geojson';
import type { EventTimeScope } from '@/utils/event-time-scope';
import {
  buildMapViewportCacheKey,
  getMapBoundsDiameterKm,
  isMapBoundsTooLarge,
  MAX_MAP_BBOX_DIAMETER_KM,
  raceWithViewportTimeout,
} from '@/utils/map-viewport-fetch-utils';
import { traceMapViewportFetch } from '@/utils/map-viewport-trace';

type BboxParams = {
  ne: [number, number];
  sw: [number, number];
  limit: number;
};

export const MAP_BBOX_TOO_LARGE_MESSAGE =
  'Zone trop large. Rapprochez-vous pour afficher les événements.';

export class MapBoundsTooLargeError extends Error {
  readonly code = 'MAP_BBOX_TOO_LARGE';
  readonly diameterKm: number;

  constructor(diameterKm: number) {
    super(MAP_BBOX_TOO_LARGE_MESSAGE);
    this.name = 'MapBoundsTooLargeError';
    this.diameterKm = diameterKm;
  }
}

export const isMapBoundsTooLargeError = (error: unknown): error is MapBoundsTooLargeError =>
  error instanceof MapBoundsTooLargeError ||
  (error as { code?: string } | null)?.code === 'MAP_BBOX_TOO_LARGE';

function assertViewportBoundsAllowed(bbox: BboxParams): void {
  if (!isMapBoundsTooLarge(bbox, MAX_MAP_BBOX_DIAMETER_KM)) return;
  throw new MapBoundsTooLargeError(getMapBoundsDiameterKm(bbox));
}

export type MapViewportPayload = {
  events: EventWithCreator[];
  featureCollection: EventMapFeatureCollection;
};

/**
 * Prefer RPC 1-hop card-lite path. Falls back to legacy bbox + get_events_by_ids
 * on missing function / statement timeout / client race timeout.
 */
const USE_MAP_VIEWPORT_RPC = true;

const viewportInflight = new Map<string, Promise<MapViewportPayload>>();

const isMissingViewportRpc = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    (message.includes('function') && message.includes('does not exist')) ||
    message.includes('could not find the function') ||
    message.includes('list_map_viewport')
  );
};

const isTransientViewportRpcFailure = (error: unknown) => {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    code === '57014' ||
    message.includes('statement timeout') ||
    message.includes('canceling statement') ||
    message.includes('timeout') ||
    message.includes('upstream connect error') ||
    message.includes('cloudflare')
  );
};

type MapViewportRpcResult = {
  events?: EventWithCreator[];
  featureCollection?: EventMapFeatureCollection;
};

/**
 * Map viewport fetch. When USE_MAP_VIEWPORT_RPC is true, falls back on missing RPC / timeout.
 */
export async function listMapViewportForMap(
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
): Promise<MapViewportPayload> {
  assertViewportBoundsAllowed(bbox);
  if (!USE_MAP_VIEWPORT_RPC) {
    return listMapViewportLegacyFallback(bbox, timeScope, options);
  }

  const cacheKey = buildMapViewportCacheKey(bbox, timeScope, options);
  const existing = viewportInflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const rpcPromise = EventsService.listMapViewport({
        ...bbox,
        timeScope,
        mergeUpcoming: Boolean(options?.mergeUpcomingForDatePreset && timeScope === 'current'),
      });
      const result = await raceWithViewportTimeout<MapViewportRpcResult>(rpcPromise);
      return {
        events: result.events || [],
        featureCollection: (result.featureCollection || {
          type: 'FeatureCollection',
          features: [],
        }) as EventMapFeatureCollection,
      };
    } catch (error) {
      if (!isMissingViewportRpc(error) && !isTransientViewportRpcFailure(error)) {
        throw error;
      }
      traceMapViewportFetch('rpcFallback', {
        outcome: isTransientViewportRpcFailure(error) ? 'timeout' : 'fallback',
        cacheKey,
      });
      console.warn('[listMapViewportForMap] RPC unavailable/slow — falling back to bbox + getByIds', error);
      return listMapViewportLegacyFallback(bbox, timeScope, options);
    } finally {
      viewportInflight.delete(cacheKey);
    }
  })();

  viewportInflight.set(cacheKey, request);
  return request;
}

/** Kept for search preview / legacy callers. */
export async function listEventsByBBoxForMap(
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
): Promise<EventMapFeatureCollection | null> {
  assertViewportBoundsAllowed(bbox);
  let collection = (await EventsService.listEventsByBBox({
    ...bbox,
    timeScope,
  })) as EventMapFeatureCollection | null;

  if (timeScope === 'current' && options?.mergeUpcomingForDatePreset) {
    const upcoming = (await EventsService.listEventsByBBox({
      ...bbox,
      timeScope: 'upcoming',
    })) as EventMapFeatureCollection | null;
    collection = mergeFeatureCollections(collection, upcoming);
  }

  return collection;
}

async function listMapViewportLegacyFallback(
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
): Promise<MapViewportPayload> {
  const featureCollection = (await listEventsByBBoxForMap(bbox, timeScope, options)) || {
    type: 'FeatureCollection' as const,
    features: [],
  };
  const ids =
    featureCollection.features
      ?.map((f) => f?.properties?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0) ?? [];
  const uniqueIds = Array.from(new Set(ids));
  const events = uniqueIds.length ? await EventsService.getEventsByIds(uniqueIds) : [];
  return {
    events,
    featureCollection: featureCollection as EventMapFeatureCollection,
  };
}

export type { FeatureCollection };
