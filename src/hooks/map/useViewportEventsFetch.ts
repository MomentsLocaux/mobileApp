import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { FeatureCollection } from 'geojson';
import type { MapWrapperHandle } from '@/components/map';
import { useMapResultsUIStore } from '@/store';
import type { EventWithCreator } from '@/types/database';
import type { EventFilters, SortOption, SortOrder } from '@/types/filters';
import { type EventMapFeatureCollection, type MapBounds, filterFeatureCollectionByEventIds } from '@/types/map-events';
import { listMapViewportForMap } from '@/utils/bbox-event-fetch';
import type { EventMetaFilter } from '@/utils/filter-events';
import { filterEvents, filterEventsByMetaStatus } from '@/utils/filter-events';
import { resolveEventTimeScope } from '@/utils/event-time-scope';
import { MAP_SHEET_LIST_LIMIT, resolveMapViewportLimit } from '@/utils/search-helpers';
import { sortEvents } from '@/utils/sort-events';

const hasWhenFilters = (filters: EventFilters) =>
  !!(filters.time || filters.startDate || filters.endDate);

const pickWhenFilters = (filters: EventFilters): EventFilters => ({
  includePast: filters.includePast,
  time: filters.time,
  startDate: filters.startDate,
  endDate: filters.endDate,
});

const hasWhatFilters = (filters: EventFilters) =>
  !!(
    (filters.categories && filters.categories.length > 0) ||
    (filters.subcategories && filters.subcategories.length > 0) ||
    (filters.tags && filters.tags.length > 0) ||
    filters.name
  );

const pickWhatFilters = (filters: EventFilters): EventFilters => ({
  categories: filters.categories,
  subcategories: filters.subcategories,
  tags: filters.tags,
  name: filters.name,
});

const hasBrowseFilters = (filters: EventFilters) => hasWhenFilters(filters) || hasWhatFilters(filters);

export type ViewportFetchOptions = {
  immediate?: boolean;
  force?: boolean;
  metaFilter?: EventMetaFilter;
  /** Internal: one silent retry after cold-start / transient failure. */
  retried?: boolean;
};

type RawViewportCache = {
  events: EventWithCreator[];
  featureCollection: EventMapFeatureCollection;
  timeScope: ReturnType<typeof resolveEventTimeScope>;
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

  const publishFilteredViewport = useCallback(
    (
      events: EventWithCreator[],
      featureCollection: EventMapFeatureCollection | FeatureCollection | null,
      options?: { metaFilter?: EventMetaFilter; searchFilters?: EventFilters }
    ) => {
      const currentMetaFilter = options?.metaFilter ?? metaFilterRef.current;
      const currentSearchApplied = searchAppliedRef.current;
      const currentHasSearchCriteria = hasSearchCriteriaRef.current;
      const currentSearchFilters = options?.searchFilters ?? searchFiltersRef.current;
      const currentSortBy = sortByRef.current;
      const currentSortOrder = sortOrderRef.current;
      const currentSortCenter = sortCenterRef.current;

      const effectiveSearchActive =
        currentMetaFilter === 'all' && currentSearchApplied && currentHasSearchCriteria;
      const effectiveFilters = effectiveSearchActive ? currentSearchFilters : {};
      const browseFilters: EventFilters = {
        ...pickWhenFilters(currentSearchFilters),
        ...pickWhatFilters(currentSearchFilters),
      };

      let filteredEvents = events;
      if (effectiveSearchActive) {
        filteredEvents = filterEvents(events, effectiveFilters, null);
      } else if (hasBrowseFilters(browseFilters)) {
        filteredEvents = filterEvents(events, browseFilters, null);
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
        ? filterFeatureCollectionByEventIds(
            featureCollection as EventMapFeatureCollection,
            filteredIds
          )
        : { type: 'FeatureCollection' as const, features: [] };

      mapRef.current?.setShape(filteredFeatures as FeatureCollection);

      const currentUiState = useMapResultsUIStore.getState();
      if (currentUiState.sheetStatus === 'singleEvent') return;
      if (viewportFrozenRef.current) return;

      const sheetEvents = dedupedEvents.slice(0, MAP_SHEET_LIST_LIMIT);
      displayViewportResults(sheetEvents, { totalCount: dedupedEvents.length });
    },
    [displayViewportResults, mapRef, viewportFrozenRef]
  );

  /** Re-run client filters/sort on the last RPC payload — no network, no loading flash. */
  const reapplyClientFilters = useCallback(
    (options?: { metaFilter?: EventMetaFilter; searchFilters?: EventFilters }) => {
      const raw = lastViewportRawRef.current;
      if (!raw) return false;
      if (options?.searchFilters) {
        searchFiltersRef.current = options.searchFilters;
      }
      if (options?.metaFilter) {
        metaFilterRef.current = options.metaFilter;
      }
      publishFilteredViewport(raw.events, raw.featureCollection, options);
      return true;
    },
    [publishFilteredViewport]
  );

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

        const effectiveSearchActive =
          currentMetaFilter === 'all' && currentSearchApplied && currentHasSearchCriteria;
        const bboxTimeScope = resolveEventTimeScope({
          metaFilter: currentMetaFilter,
          searchActive: effectiveSearchActive,
          includePast: currentIncludePast,
        });
        const whenOnlyFilters = pickWhenFilters(currentSearchFilters);

        const bboxParams = {
          ne: bounds.ne,
          sw: bounds.sw,
          limit: resolveMapViewportLimit(zoomRef.current),
        };
        const mergeUpcomingForDatePreset =
          currentMetaFilter === 'all' &&
          hasWhenFilters(whenOnlyFilters) &&
          bboxTimeScope === 'current';

        const fetchViewport = async (timeScope: typeof bboxTimeScope) =>
          listMapViewportForMap(bboxParams, timeScope, {
            mergeUpcomingForDatePreset: mergeUpcomingForDatePreset && timeScope === 'current',
          });

        let viewport = await fetchViewport(bboxTimeScope);

        if (!isViewportRequestCurrent(requestId)) return;

        let featureCollection = viewport.featureCollection;
        let events: EventWithCreator[] = viewport.events;

        if (
          events.length === 0 &&
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
        };

        if (!viewportFrozenRef.current) {
          frozenViewportBoundsRef.current = bounds;
        }

        if (!isViewportRequestCurrent(requestId)) return;

        publishFilteredViewport(events, featureCollection, { metaFilter: currentMetaFilter });
        // If publish early-returned (frozen / singleEvent), never leave the sheet stuck on loading.
        if (
          isViewportRequestCurrent(requestId) &&
          useMapResultsUIStore.getState().sheetStatus === 'loading'
        ) {
          setStatus('browsing');
        }
      } catch (error) {
        if (!isViewportRequestCurrent(requestId)) return;
        console.warn('bbox fetch error', error);
        // Cold-start / statement timeout: one silent retry before alarming the user.
        if (!options?.retried) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          if (!isViewportRequestCurrent(requestId)) return;
          return runViewportFetch(bounds, requestId, { ...options, force: true, retried: true });
        }
        setViewportFetchError('Impossible de charger les événements. Vérifiez votre connexion.');
        setStatus('browsing');
      }
    },
    [
      frozenViewportBoundsRef,
      isViewportRequestCurrent,
      publishFilteredViewport,
      setStatus,
      setViewportFetchError,
      viewportFrozenRef,
      zoomRef,
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
      // Avoid loading→loading flicker when bootstrap triggers several overlapping fetches.
      if (
        (options?.immediate || options?.force) &&
        shouldShowLoading &&
        uiState.sheetStatus !== 'loading'
      ) {
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
    reapplyClientFilters,
    cancelViewportFetch,
    cancelMarkerFetch,
    cancelAllMapRequests,
    nextMarkerRequestId,
    isMarkerRequestCurrent,
  };
}
