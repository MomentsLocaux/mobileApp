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
import { listEventsByBBoxForMap } from '@/utils/bbox-event-fetch';
import type { EventMetaFilter } from '@/utils/filter-events';
import { filterEvents, filterEventsByMetaStatus } from '@/utils/filter-events';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { SEARCH_FETCH_LIMIT } from '@/utils/search-helpers';
import { sortEvents } from '@/utils/sort-events';
import type { SortOption, SortOrder } from '@/types/filters';
import type { EventFilters } from '@/types/filters';

const hasWhenFilters = (filters: EventFilters) =>
  !!(filters.time || filters.startDate || filters.endDate);

const pickWhenFilters = (filters: EventFilters): EventFilters => ({
  includePast: filters.includePast,
  time: filters.time,
  startDate: filters.startDate,
  endDate: filters.endDate,
});
import type { MapWrapperHandle } from '@/components/map';

export type ViewportFetchOptions = {
  immediate?: boolean;
  force?: boolean;
  metaFilter?: EventMetaFilter;
};

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
  const metaFilterRef = useRef(metaFilter);
  const searchAppliedRef = useRef(searchApplied);
  const hasSearchCriteriaRef = useRef(hasSearchCriteria);
  const includePastRef = useRef(includePast);
  const searchFiltersRef = useRef(searchFilters);
  const sortByRef = useRef(sortBy);
  const sortOrderRef = useRef(sortOrder);
  const sortCenterRef = useRef(sortCenter);
  const { setStatus, setViewportFetchError, displayViewportResults } = useMapResultsUIStore();

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
    async (bounds: MapBounds, requestId: number, options?: ViewportFetchOptions) => {
      if (!isViewportRequestCurrent(requestId)) return;
      const uiState = useMapResultsUIStore.getState();
      if (uiState.bottomSheetIndex === 0 && uiState.sheetStatus !== 'singleEvent') {
        setStatus('loading');
      }
      setViewportFetchError(null);

      try {
        const currentMetaFilter = options?.metaFilter ?? metaFilterRef.current;
        const currentSearchApplied = searchAppliedRef.current;
        const currentHasSearchCriteria = hasSearchCriteriaRef.current;
        const currentIncludePast = includePastRef.current;
        const currentSearchFilters = searchFiltersRef.current;
        const currentSortBy = sortByRef.current;
        const currentSortOrder = sortOrderRef.current;
        const currentSortCenter = sortCenterRef.current;

        const effectiveSearchActive =
          currentMetaFilter === 'all' && currentSearchApplied && currentHasSearchCriteria;
        const bboxTimeScope = resolveEventTimeScope({
          metaFilter: currentMetaFilter,
          searchActive: effectiveSearchActive,
          includePast: currentIncludePast,
        });
        const effectiveFilters = effectiveSearchActive ? currentSearchFilters : {};
        const whenOnlyFilters = pickWhenFilters(currentSearchFilters);

        const bboxParams = { ne: bounds.ne, sw: bounds.sw, limit: SEARCH_FETCH_LIMIT };
        const mergeUpcomingForDatePreset =
          currentMetaFilter === 'all' &&
          hasWhenFilters(whenOnlyFilters) &&
          bboxTimeScope === 'current';

        const fetchBBox = async (timeScope: typeof bboxTimeScope) =>
          listEventsByBBoxForMap(bboxParams, timeScope, {
            mergeUpcomingForDatePreset: mergeUpcomingForDatePreset && timeScope === 'current',
          });

        let featureCollection = await fetchBBox(bboxTimeScope);

        if (!isViewportRequestCurrent(requestId)) return;

        let uniqueIds = extractEventIdsFromFeatureCollection(featureCollection);
        let events: EventWithCreator[] = uniqueIds.length
          ? await EventsService.getEventsByIds(uniqueIds)
          : [];

        if (!isViewportRequestCurrent(requestId)) return;

        if (
          events.length === 0 &&
          (currentMetaFilter === 'upcoming' || currentMetaFilter === 'live') &&
          bboxTimeScope !== 'all'
        ) {
          const fallbackCollection = await fetchBBox('all');
          if (!isViewportRequestCurrent(requestId)) return;

          const fallbackIds = extractEventIdsFromFeatureCollection(fallbackCollection);
          const fallbackEvents: EventWithCreator[] = fallbackIds.length
            ? await EventsService.getEventsByIds(fallbackIds)
            : [];

          if (!isViewportRequestCurrent(requestId)) return;

          const fallbackMatches = filterEventsByMetaStatus(fallbackEvents, currentMetaFilter);
          if (fallbackMatches.length > 0) {
            featureCollection = fallbackCollection;
            uniqueIds = fallbackIds;
            events = fallbackEvents;
          }
        }

        let filteredEvents = events;
        if (effectiveSearchActive) {
          filteredEvents = filterEvents(events, effectiveFilters, null);
        } else if (hasWhenFilters(whenOnlyFilters)) {
          filteredEvents = filterEvents(events, whenOnlyFilters, null);
        }
        const metaFilteredEvents = filterEventsByMetaStatus(filteredEvents, currentMetaFilter);
        const sortedEvents =
          currentSortBy !== 'triage'
            ? sortEvents(metaFilteredEvents, currentSortBy, currentSortCenter, currentSortOrder)
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
        console.warn('bbox fetch error', error);
        setViewportFetchError('Impossible de charger les événements. Vérifiez votre connexion.');
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
      setViewportFetchError,
      sortBy,
      sortCenter,
      sortOrder,
      viewportFrozenRef,
    ]
  );

  const queueViewportFetch = useCallback(
    (bounds: MapBounds, options?: ViewportFetchOptions) => {
      if (viewportFrozenRef.current && !options?.force) return;
      if (isProgrammaticMoveRef.current && !options?.force) return;

      clearDebouncedViewportFetch();
      const requestId = nextViewportRequestId();
      const uiState = useMapResultsUIStore.getState();
      const shouldShowLoading =
        uiState.bottomSheetIndex === 0 && uiState.sheetStatus !== 'singleEvent';
      if ((options?.immediate || options?.force) && shouldShowLoading) {
        setStatus('loading');
      } else if (!options?.immediate && !options?.force) {
        setStatus('browsing');
      }

      const execute = () => {
        void runViewportFetch(bounds, requestId, options);
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
