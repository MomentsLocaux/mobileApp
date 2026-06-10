import { useRef } from 'react';
import type { RefObject } from 'react';
import type { MapWrapperHandle } from '@/components/map';
import type { EventFilters, SortOption, SortOrder } from '@/types/filters';
import type { EventMetaFilter } from '@/utils/filter-events';
import type { MapBounds } from '@/types/map-events';
import { useMapProgrammaticMove } from './useMapProgrammaticMove';
import { useViewportEventsFetch } from './useViewportEventsFetch';
import { useMapViewportController } from './useMapViewportController';

type UserLocation = { latitude: number; longitude: number } | null;

type Params = {
  mapRef: RefObject<MapWrapperHandle | null>;
  isSheetDraggingRef: RefObject<boolean>;
  zoomRef: RefObject<number>;
  clearFrozenViewport: () => void;
  freezeViewportResults: () => void;
  onUnlockViewport?: () => void;
  metaFilter: EventMetaFilter;
  searchApplied: boolean;
  hasSearchCriteria: boolean;
  includePast: boolean;
  searchFilters: EventFilters;
  sortBy: SortOption;
  sortOrder?: SortOrder;
  sortCenter: UserLocation;
};

export function useMapScreenData(params: Params) {
  const viewportFrozenRef = useRef(false);
  const frozenViewportBoundsRef = useRef<MapBounds | null>(null);
  const programmatic = useMapProgrammaticMove();

  const fetch = useViewportEventsFetch({
    mapRef: params.mapRef,
    viewportFrozenRef,
    frozenViewportBoundsRef,
    isProgrammaticMoveRef: programmatic.isProgrammaticMoveRef,
    metaFilter: params.metaFilter,
    searchApplied: params.searchApplied,
    hasSearchCriteria: params.hasSearchCriteria,
    includePast: params.includePast,
    searchFilters: params.searchFilters,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    sortCenter: params.sortCenter,
  });

  const viewport = useMapViewportController({
    mapRef: params.mapRef,
    isSheetDraggingRef: params.isSheetDraggingRef,
    viewportFrozenRef,
    frozenViewportBoundsRef,
    programmatic,
    queueViewportFetch: fetch.queueViewportFetch,
    clearFrozenViewport: params.clearFrozenViewport,
    freezeViewportResults: params.freezeViewportResults,
    zoomRef: params.zoomRef,
    onUnlockViewport: params.onUnlockViewport,
  });

  return {
    viewportFrozenRef,
    frozenViewportBoundsRef,
    programmatic,
    fetch,
    viewport,
  };
}
