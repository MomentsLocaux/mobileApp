import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { FeatureCollection } from 'geojson';
import { EventsService } from '@/services/events.service';
import { useMapResultsUIStore } from '@/store';
import type { EventWithCreator } from '@/types/database';
import {
  extractEventIdsFromFeatureCollection,
  filterFeatureCollectionByEventIds,
  type EventMapFeatureCollection,
  type MapBounds,
} from '@/types/map-events';
import type { EventMetaFilter } from '@/utils/filter-events';
import { filterEvents, filterEventsByMetaStatus } from '@/utils/filter-events';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import { sortEvents } from '@/utils/sort-events';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventFilters } from '@/types/filters';
import type { MapWrapperHandle } from '@/components/map';

type Params = {
  mapRef: RefObject<MapWrapperHandle | null>;
  viewportFrozenRef: RefObject<boolean>;
  frozenViewportBoundsRef: RefObject<MapBounds | null>;
  isProgrammaticMoveRef: RefObject<boolean>;
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
  const markerRequestIdRef = useRef(0);
  const { setStatus, displayViewportResults } = useMapResultsUIStore();

  const clearDebouncedViewportFetch = useCallback(() => {
    if (bboxTimeoutRef.current) {
      clearTimeout(bboxTimeoutRef.current);
      bboxTimeoutRef.current = null;
    }
  }, []);

  const cancelViewportFetch = useCallback(() => {
    viewportRequestIdRef.current += 1;
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

  const runViewportFetch = useCallback(
    async (bounds: MapBounds, requestId: number) => {
      if (!isViewportRequestCurrent(requestId)) return;
      setStatus('loading');

      try {
        const effectiveSearchActive = metaFilter === 'all' && searchApplied && hasSearchCriteria;
        const bboxTimeScope = resolveEventTimeScope({
          metaFilter,
          searchActive: effectiveSearchActive,
          includePast,
        });
        const effectiveFilters = effectiveSearchActive ? searchFilters : {};

        const featureCollection = (await EventsService.listEventsByBBox({
          ne: bounds.ne,
          sw: bounds.sw,
          limit: SEARCH_FETCH_LIMIT,
          timeScope: bboxTimeScope,
        })) as EventMapFeatureCollection | null;

        if (!isViewportRequestCurrent(requestId)) return;

        const uniqueIds = extractEventIdsFromFeatureCollection(featureCollection);
        const events: EventWithCreator[] = uniqueIds.length
          ? await EventsService.getEventsByIds(uniqueIds)
          : [];

        if (!isViewportRequestCurrent(requestId)) return;

        const filteredEvents = effectiveSearchActive
          ? filterEvents(events, effectiveFilters, null)
          : events;
        const metaFilteredEvents = filterEventsByMetaStatus(filteredEvents, metaFilter);
        const sortedEvents =
          sortBy !== 'triage'
            ? sortEvents(metaFilteredEvents, sortBy, sortCenter, sortOrder)
            : metaFilteredEvents;
        const dedupedEvents = Array.from(
          new Map(sortedEvents.map((event) => [event.id, event])).values()
        );

        const filteredIds = new Set(dedupedEvents.map((event) => event.id));
        const filteredFeatures = featureCollection
          ? filterFeatureCollectionByEventIds(featureCollection, filteredIds)
          : { type: 'FeatureCollection' as const, features: [] };

        if (!isViewportRequestCurrent(requestId)) return;

        if (!viewportFrozenRef.current) {
          frozenViewportBoundsRef.current = bounds;
        }

        mapRef.current?.setShape(filteredFeatures as FeatureCollection);

        const currentUiState = useMapResultsUIStore.getState();
        if (currentUiState.sheetStatus === 'singleEvent') return;
        if (viewportFrozenRef.current) return;

        displayViewportResults(dedupedEvents);
      } catch (error) {
        if (!isViewportRequestCurrent(requestId)) return;
        // TODO: dedicated error state in mapResultsUIStore when product supports it.
        console.warn('bbox fetch error', error);
        setStatus('browsing');
      }
    },
    [
      displayViewportResults,
      frozenViewportBoundsRef,
      hasSearchCriteria,
      includePast,
      isViewportRequestCurrent,
      mapRef,
      metaFilter,
      searchApplied,
      searchFilters,
      setStatus,
      sortBy,
      sortCenter,
      sortOrder,
      viewportFrozenRef,
    ]
  );

  const queueViewportFetch = useCallback(
    (
      bounds: MapBounds,
      options?: { immediate?: boolean; force?: boolean }
    ) => {
      if (viewportFrozenRef.current && !options?.force) return;
      if (isProgrammaticMoveRef.current && !options?.force) return;

      clearDebouncedViewportFetch();
      const requestId = nextViewportRequestId();
      setStatus('browsing');

      const execute = () => {
        void runViewportFetch(bounds, requestId);
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
      runViewportFetch,
      setStatus,
      viewportFrozenRef,
    ]
  );

  return {
    clearDebouncedViewportFetch,
    queueViewportFetch,
    runViewportFetch,
    cancelViewportFetch,
    cancelMarkerFetch,
    cancelAllMapRequests,
    nextMarkerRequestId,
    isMarkerRequestCurrent,
  };
}
