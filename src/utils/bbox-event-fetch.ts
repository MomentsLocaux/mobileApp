import { EventsService } from '@/services/events.service';
import {
  mergeFeatureCollections,
  type EventMapFeatureCollection,
} from '@/types/map-events';
import type { EventWithCreator } from '@/types/database';
import type { FeatureCollection } from 'geojson';
import type { EventTimeScope } from '@/utils/event-time-scope';

type BboxParams = {
  ne: [number, number];
  sw: [number, number];
  limit: number;
};

export type MapViewportPayload = {
  events: EventWithCreator[];
  featureCollection: EventMapFeatureCollection;
};

/**
 * Prefer RPC 1-hop card-lite path. Falls back to legacy bbox + get_events_by_ids
 * on missing function / statement timeout / client race timeout.
 */
const USE_MAP_VIEWPORT_RPC = true;

const RPC_CLIENT_TIMEOUT_MS = 2500;

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

/**
 * Map viewport fetch. Currently forces legacy bbox + get_events_by_ids.
 * When USE_MAP_VIEWPORT_RPC is true, falls back on missing RPC / timeout.
 */
export async function listMapViewportForMap(
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
): Promise<MapViewportPayload> {
  if (!USE_MAP_VIEWPORT_RPC) {
    return listMapViewportLegacyFallback(bbox, timeScope, options);
  }

  try {
    const rpcPromise = EventsService.listMapViewport({
      ...bbox,
      timeScope,
      mergeUpcoming: Boolean(options?.mergeUpcomingForDatePreset && timeScope === 'current'),
    });
    const result = await Promise.race([
      rpcPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(Object.assign(new Error('list_map_viewport client timeout'), { code: '57014' }));
        }, RPC_CLIENT_TIMEOUT_MS);
      }),
    ]);
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
    console.warn('[listMapViewportForMap] RPC unavailable/slow — falling back to bbox + getByIds', error);
    return listMapViewportLegacyFallback(bbox, timeScope, options);
  }
}

/** Kept for search preview / legacy callers. */
export async function listEventsByBBoxForMap(
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
): Promise<EventMapFeatureCollection | null> {
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
