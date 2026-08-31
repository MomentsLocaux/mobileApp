import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { FeatureCollection } from 'geojson';
import type { MapWrapperHandle } from '@/components/map';
import { useMapResultsUIStore } from '@/store';
import type { EventWithCreator } from '@/types/database';
import type { EventFilters, SortOption, SortOrder } from '@/types/filters';
import { type EventMapFeatureCollection, type MapBounds, filterFeatureCollectionByEventIds } from '@/types/map-events';
import {
  isMapBoundsTooLargeError,
  listMapViewportForMap,
  MAP_BBOX_TOO_LARGE_MESSAGE,
} from '@/utils/bbox-event-fetch';
import {
  listEventsByNameQuery,
  mergeEventsById,
} from '@/utils/fetch-discovery-search-events';
import { buildMapMarkerCollection } from '@/utils/map-marker-features';
import {
  buildMapViewportCacheKey,
  getViewportCacheDisposition,
  isMapBoundsTooLarge,
} from '@/utils/map-viewport-fetch-utils';
import {
  buildViewportBoundsKey,
  shouldSkipDuplicateViewportFetch,
} from '@/utils/map-viewport-request';
import type { EventMetaFilter } from '@/utils/filter-events';
import { filterEvents, filterEventsByMetaStatus } from '@/utils/filter-events';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { MAP_SHEET_LIST_LIMIT, resolveMapViewportLimit, SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import { sortEvents } from '@/utils/sort-events';
import { traceMapViewportFetch } from '@/utils/map-viewport-trace';
import { resolveMapClientFilters, shouldPublishViewportToMap } from '@/utils/map-discovery-contract';

const VIEWPORT_PAYLOAD_CACHE_MAX = 4;
const VIEWPORT_PAYLOAD_FRESH_MS = 45 * 1000;
const VIEWPORT_PAYLOAD_MAX_STALE_MS = 5 * 60 * 1000;

const hasWhenFilters = (filters: EventFilters) =>
  !!(filters.time || filters.startDate || filters.endDate);

const pickWhenFilters = (filters: EventFilters): EventFilters => ({
  includePast: filters.includePast,
  time: filters.time,
  startDate: filters.startDate,
  endDate: filters.endDate,
});

export type ViewportFetchOptions = {
  immediate?: boolean;
  force?: boolean;
  metaFilter?: EventMetaFilter;
  /** Internal: one silent retry after cold-start / transient failure. */
  retried?: boolean;
  /** Background revalidate — do not flash loading UI when stale cache was shown. */
  silent?: boolean;
};

type ClientFilterOverrides = {
  metaFilter?: EventMetaFilter;
  searchFilters?: EventFilters;
  searchApplied?: boolean;
  hasSearchCriteria?: boolean;
  includePast?: boolean;
  /** Re-sort / re-filter even while the sheet freeze is on. */
  ignoreFreeze?: boolean;
};

type RawViewportCache = {
  events: EventWithCreator[];
  featureCollection: EventMapFeatureCollection;
  timeScope: ReturnType<typeof resolveEventTimeScope>;
  storedAt: number;
};

type Params = {
  mapRef: RefObject<MapWrapperHandle | null>;
  viewportFrozenRef: RefObject<boolean>;
  frozenViewportBoundsRef: RefObject<MapBounds | null>;
  isProgrammaticMoveRef: RefObject<boolean>;
  zoomRef: RefObject<number>;
  metaFilter: EventMetaFilter;
  searchApplied: boolean;
  hasSearchCriteria: boolean;
  includePast: boolean;
  searchFilters: EventFilters;
  sortBy: SortOption;
  sortOrder?: SortOrder;
  sortCenter: { latitude: number; longitude: number } | null;
};

export function useViewportEventsFetch({
  mapRef,
  viewportFrozenRef,
  frozenViewportBoundsRef,
  isProgrammaticMoveRef,
  zoomRef,
  metaFilter,
  searchApplied,
  hasSearchCriteria,
  includePast,
  searchFilters,
  sortBy,
  sortOrder,
  sortCenter,
}: Params) {
  const bboxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRequestIdRef = useRef(0);
  const inFlightRequestKeyRef = useRef<string | null>(null);
  const markerRequestIdRef = useRef(0);
  const metaFilterRef = useRef(metaFilter);
  const searchAppliedRef = useRef(searchApplied);
  const hasSearchCriteriaRef = useRef(hasSearchCriteria);
  const includePastRef = useRef(includePast);
  const searchFiltersRef = useRef(searchFilters);
  const sortByRef = useRef(sortBy);
  const sortOrderRef = useRef(sortOrder);
  const sortCenterRef = useRef(sortCenter);
  const lastViewportRawRef = useRef<RawViewportCache | null>(null);
  const viewportPayloadCacheRef = useRef<Map<string, RawViewportCache>>(new Map());
  const {
    setStatus,
    setViewportFetchError,
    setViewportAreaWarning,
    displayViewportResults,
  } = useMapResultsUIStore();

  metaFilterRef.current = metaFilter;
  searchAppliedRef.current = searchApplied;
  hasSearchCriteriaRef.current = hasSearchCriteria;
  includePastRef.current = includePast;
  searchFiltersRef.current = searchFilters;
  sortByRef.current = sortBy;
  sortOrderRef.current = sortOrder;
  sortCenterRef.current = sortCenter;

  const clearDebouncedViewportFetch = useCallback(() => {
    if (bboxTimeoutRef.current) {
      clearTimeout(bboxTimeoutRef.current);
      bboxTimeoutRef.current = null;
    }
  }, []);

  const cancelViewportFetch = useCallback(() => {
    viewportRequestIdRef.current += 1;
    inFlightRequestKeyRef.current = null;
    clearDebouncedViewportFetch();
  }, [clearDebouncedViewportFetch]);

  const cancelMarkerFetch = useCallback(() => {
    markerRequestIdRef.current += 1;
  }, []);

  const cancelAllMapRequests = useCallback(() => {
    cancelViewportFetch();
    cancelMarkerFetch();
  }, [cancelMarkerFetch, cancelViewportFetch]);

  const nextViewportRequestId = useCallback(() => {
    return ++viewportRequestIdRef.current;
  }, []);

  const nextMarkerRequestId = useCallback(() => {
    return ++markerRequestIdRef.current;
  }, []);

  const isViewportRequestCurrent = useCallback((requestId: number) => {
    return requestId === viewportRequestIdRef.current;
  }, []);

  const isMarkerRequestCurrent = useCallback((requestId: number) => {
    return requestId === markerRequestIdRef.current;
  }, []);

  useEffect(() => {
    return () => {
      cancelAllMapRequests();
    };
  }, [cancelAllMapRequests]);

  const publishFilteredViewport = useCallback(
    (
      events: EventWithCreator[],
      featureCollection: EventMapFeatureCollection | FeatureCollection | null,
      options?: ClientFilterOverrides
    ) => {
      // Sheet list order is owned here — map.tsx must not re-sort displaySheetEvents.
      const currentMetaFilter = options?.metaFilter ?? metaFilterRef.current;
      const currentSearchApplied = searchAppliedRef.current;
      const currentHasSearchCriteria = hasSearchCriteriaRef.current;
      const currentSearchFilters = options?.searchFilters ?? searchFiltersRef.current;
      const currentSortBy = sortByRef.current;
      const currentSortOrder = sortOrderRef.current;
      const currentSortCenter = sortCenterRef.current;

      const effectiveSearchActive = currentSearchApplied && currentHasSearchCriteria;
      const effectiveFilters = resolveMapClientFilters(
        currentSearchFilters,
        effectiveSearchActive
      );
      const filteredEvents = filterEvents(events, effectiveFilters, null);

      const metaFilteredEvents = filterEventsByMetaStatus(filteredEvents, currentMetaFilter);
      const sortedEvents =
        currentSortBy !== 'triage'
          ? sortEvents(metaFilteredEvents, currentSortBy, currentSortCenter, currentSortOrder)
          : metaFilteredEvents;
      const dedupedEvents = Array.from(
        new Map(sortedEvents.map((event) => [event.id, event])).values()
      );

      const canPublish = shouldPublishViewportToMap({
        frozen: viewportFrozenRef.current,
        sheetStatus: useMapResultsUIStore.getState().sheetStatus,
        ignoreFreeze: options?.ignoreFreeze,
      });
      if (!canPublish) return;

      const filteredIds = new Set(dedupedEvents.map((event) => event.id));
      const filteredFeatures = featureCollection
        ? filterFeatureCollectionByEventIds(
            featureCollection as EventMapFeatureCollection,
            filteredIds
          )
        : { type: 'FeatureCollection' as const, features: [] };

      mapRef.current?.setShape(filteredFeatures as FeatureCollection);

      const sheetEvents = dedupedEvents.slice(0, MAP_SHEET_LIST_LIMIT);
      displayViewportResults(sheetEvents, { totalCount: dedupedEvents.length });
    },
    [displayViewportResults, mapRef, viewportFrozenRef]
  );

  /** Re-run client filters/sort on the last RPC payload — no network, no loading flash. */
  const reapplyClientFilters = useCallback(
    (options?: ClientFilterOverrides) => {
      if (options?.searchFilters) {
        searchFiltersRef.current = options.searchFilters;
      }
      if (options?.metaFilter) {
        metaFilterRef.current = options.metaFilter;
      }
      if (options?.searchApplied !== undefined) {
        searchAppliedRef.current = options.searchApplied;
      }
      if (options?.hasSearchCriteria !== undefined) {
        hasSearchCriteriaRef.current = options.hasSearchCriteria;
      }
      if (options?.includePast !== undefined) {
        includePastRef.current = options.includePast;
      }
      const raw = lastViewportRawRef.current;
      if (!raw) return false;
      publishFilteredViewport(raw.events, raw.featureCollection, {
        ...options,
        ignoreFreeze: true,
      });
      return true;
    },
    [publishFilteredViewport]
  );

  const rememberViewportPayload = useCallback((cacheKey: string, payload: RawViewportCache) => {
    const cache = viewportPayloadCacheRef.current;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
    }
    cache.set(cacheKey, payload);
    while (cache.size > VIEWPORT_PAYLOAD_CACHE_MAX) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }, []);

  const resolveServerRequest = useCallback(
    (bounds: MapBounds, metaFilterValue: EventMetaFilter) => {
      const effectiveSearchActive =
        searchAppliedRef.current && hasSearchCriteriaRef.current;
      const timeScope = resolveEventTimeScope({
        metaFilter: metaFilterValue,
        searchActive: effectiveSearchActive,
        includePast: includePastRef.current,
      });
      const mergeUpcomingForDatePreset =
        metaFilterValue === 'all' &&
        hasWhenFilters(pickWhenFilters(searchFiltersRef.current)) &&
        timeScope === 'current';
      const bbox = {
        ne: bounds.ne,
        sw: bounds.sw,
        limit: resolveMapViewportLimit(zoomRef.current),
      };

      return {
        bbox,
        timeScope,
        mergeUpcomingForDatePreset,
        requestKey: `${buildMapViewportCacheKey(bbox, timeScope, {
          mergeUpcomingForDatePreset,
        })}|q:${(searchFiltersRef.current.name || '').trim().toLowerCase()}`,
      };
    },
    [zoomRef]
  );

  const runViewportFetch = useCallback(
    async (bounds: MapBounds, requestId: number, options?: ViewportFetchOptions) => {
      if (!isViewportRequestCurrent(requestId)) return;
      const boundsKey = buildViewportBoundsKey(bounds, resolveMapViewportLimit(zoomRef.current));
      const currentMetaFilter = options?.metaFilter ?? metaFilterRef.current;
      const serverRequest = resolveServerRequest(bounds, currentMetaFilter);
      inFlightRequestKeyRef.current = serverRequest.requestKey;
      const uiState = useMapResultsUIStore.getState();
      if (
        !options?.silent &&
        uiState.bottomSheetIndex === 0 &&
        uiState.sheetStatus !== 'singleEvent'
      ) {
        setStatus('loading');
      }
      setViewportFetchError(null);

      const startedAt = Date.now();
      try {
        const bboxTimeScope = serverRequest.timeScope;
        const bboxParams = serverRequest.bbox;
        const mergeUpcomingForDatePreset = serverRequest.mergeUpcomingForDatePreset;

        const fetchViewport = async (timeScope: typeof bboxTimeScope) =>
          listMapViewportForMap(bboxParams, timeScope, {
            mergeUpcomingForDatePreset: mergeUpcomingForDatePreset && timeScope === 'current',
          });

        let viewport = await fetchViewport(bboxTimeScope);

        if (!isViewportRequestCurrent(requestId)) return;

        let featureCollection = viewport.featureCollection;
        let events: EventWithCreator[] = viewport.events;

        const nameQuery = searchAppliedRef.current
          ? (searchFiltersRef.current.name || '').trim()
          : '';
        if (nameQuery) {
          const named = await listEventsByNameQuery({
            nameQuery,
            timeScope: bboxTimeScope,
            limit: Math.min(SEARCH_FETCH_LIMIT, bboxParams.limit),
            bbox: { ne: bboxParams.ne, sw: bboxParams.sw },
          });
          if (!isViewportRequestCurrent(requestId)) return;
          events = mergeEventsById(events, named);
          featureCollection = buildMapMarkerCollection(events) as EventMapFeatureCollection;
        }

        if (
          events.length === 0 &&
          !nameQuery &&
          (currentMetaFilter === 'upcoming' || currentMetaFilter === 'live') &&
          bboxTimeScope !== 'all'
        ) {
          const fallback = await fetchViewport('all');
          if (!isViewportRequestCurrent(requestId)) return;

          const fallbackMatches = filterEventsByMetaStatus(fallback.events, currentMetaFilter);
          if (fallbackMatches.length > 0) {
            featureCollection = fallback.featureCollection;
            events = fallback.events;
          }
        }

        lastViewportRawRef.current = {
          events,
          featureCollection: featureCollection as EventMapFeatureCollection,
          timeScope: bboxTimeScope,
          storedAt: Date.now(),
        };
        rememberViewportPayload(serverRequest.requestKey, lastViewportRawRef.current);

        if (!viewportFrozenRef.current) {
          frozenViewportBoundsRef.current = bounds;
        }

        if (!isViewportRequestCurrent(requestId)) return;

        publishFilteredViewport(events, featureCollection, { metaFilter: currentMetaFilter });
        traceMapViewportFetch('fetchComplete', {
          outcome: 'success',
          durationMs: Date.now() - startedAt,
          eventCount: events.length,
          boundsKey,
        });
        // If publish early-returned (frozen / singleEvent), never leave the sheet stuck on loading.
        if (
          isViewportRequestCurrent(requestId) &&
          useMapResultsUIStore.getState().sheetStatus === 'loading'
        ) {
          setStatus('browsing');
        }
      } catch (error) {
        if (!isViewportRequestCurrent(requestId)) return;
        if (isMapBoundsTooLargeError(error)) {
          setViewportAreaWarning(MAP_BBOX_TOO_LARGE_MESSAGE);
          setStatus(
            useMapResultsUIStore.getState().sheetEvents.length > 0
              ? 'viewportResults'
              : 'browsing'
          );
          return;
        }
        console.warn('bbox fetch error', error);
        traceMapViewportFetch('fetchComplete', {
          outcome: options?.retried ? 'error' : 'retry',
          durationMs: Date.now() - startedAt,
          boundsKey,
        });
        // Cold-start / statement timeout: one silent retry before alarming the user.
        if (!options?.retried) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          if (!isViewportRequestCurrent(requestId)) return;
          return runViewportFetch(bounds, requestId, { ...options, force: true, retried: true });
        }
        setViewportFetchError('Impossible de charger les événements. Vérifiez votre connexion.');
        setStatus('browsing');
      } finally {
        if (
          isViewportRequestCurrent(requestId) &&
          inFlightRequestKeyRef.current === serverRequest.requestKey
        ) {
          inFlightRequestKeyRef.current = null;
        }
      }
    },
    [
      frozenViewportBoundsRef,
      isViewportRequestCurrent,
      publishFilteredViewport,
      rememberViewportPayload,
      resolveServerRequest,
      setStatus,
      setViewportAreaWarning,
      setViewportFetchError,
      viewportFrozenRef,
      zoomRef,
    ]
  );

  const queueViewportFetch = useCallback(
    (bounds: MapBounds, options?: ViewportFetchOptions) => {
      if (viewportFrozenRef.current && !options?.force) return;
      if (isProgrammaticMoveRef.current && !options?.force) return;

      if (isMapBoundsTooLarge(bounds)) {
        viewportRequestIdRef.current += 1;
        inFlightRequestKeyRef.current = null;
        clearDebouncedViewportFetch();
        setViewportFetchError(null);
        setViewportAreaWarning(MAP_BBOX_TOO_LARGE_MESSAGE);
        const uiState = useMapResultsUIStore.getState();
        if (uiState.sheetStatus === 'loading') {
          setStatus(uiState.sheetEvents.length > 0 ? 'viewportResults' : 'browsing');
        }
        traceMapViewportFetch('queueSkipped', {
          outcome: 'bounds-too-large',
          bounds,
        });
        return;
      }
      setViewportAreaWarning(null);

      const currentMetaFilter = options?.metaFilter ?? metaFilterRef.current;
      const serverRequest = resolveServerRequest(bounds, currentMetaFilter);
      if (
        shouldSkipDuplicateViewportFetch(
          inFlightRequestKeyRef.current,
          serverRequest.requestKey,
          options
        )
      ) {
        traceMapViewportFetch('queueSkipped', {
          outcome: 'deduped',
          requestKey: serverRequest.requestKey,
        });
        return;
      }

      const now = Date.now();
      let cachedPayload = !options?.force
        ? viewportPayloadCacheRef.current.get(serverRequest.requestKey)
        : undefined;
      const cacheAgeMs = cachedPayload ? now - cachedPayload.storedAt : null;
      const cacheDisposition = cachedPayload
        ? getViewportCacheDisposition(
            cachedPayload.storedAt,
            now,
            VIEWPORT_PAYLOAD_FRESH_MS,
            VIEWPORT_PAYLOAD_MAX_STALE_MS
          )
        : null;
      if (cachedPayload && cacheDisposition === 'expired') {
        viewportPayloadCacheRef.current.delete(serverRequest.requestKey);
        cachedPayload = undefined;
      }
      if (cachedPayload) {
        lastViewportRawRef.current = cachedPayload;
        publishFilteredViewport(cachedPayload.events, cachedPayload.featureCollection, {
          metaFilter: currentMetaFilter,
        });
        traceMapViewportFetch('serveStaleCache', {
          outcome: 'stale-cache',
          requestKey: serverRequest.requestKey,
          cacheAgeMs,
        });
        if (cacheDisposition === 'fresh') {
          return;
        }
      }

      clearDebouncedViewportFetch();
      const requestId = nextViewportRequestId();
      const uiState = useMapResultsUIStore.getState();
      const shouldShowLoading =
        uiState.bottomSheetIndex === 0 && uiState.sheetStatus !== 'singleEvent';
      // Avoid loading→loading flicker when bootstrap triggers several overlapping fetches.
      if (
        !cachedPayload &&
        (options?.immediate || options?.force) &&
        shouldShowLoading &&
        uiState.sheetStatus !== 'loading'
      ) {
        setStatus('loading');
      } else if (!options?.immediate && !options?.force && !cachedPayload) {
        setStatus('browsing');
      }

      const execute = () => {
        void runViewportFetch(bounds, requestId, {
          ...options,
          silent: Boolean(cachedPayload) && !options?.force,
        });
      };

      if (options?.immediate) {
        execute();
        return;
      }

      bboxTimeoutRef.current = setTimeout(execute, 300);
    },
    [
      clearDebouncedViewportFetch,
      isProgrammaticMoveRef,
      nextViewportRequestId,
      publishFilteredViewport,
      resolveServerRequest,
      runViewportFetch,
      setStatus,
      setViewportAreaWarning,
      setViewportFetchError,
      viewportFrozenRef,
    ]
  );

  return {
    clearDebouncedViewportFetch,
    queueViewportFetch,
    runViewportFetch,
    reapplyClientFilters,
    cancelViewportFetch,
    cancelMarkerFetch,
    cancelAllMapRequests,
    nextMarkerRequestId,
    isMarkerRequestCurrent,
  };
}
