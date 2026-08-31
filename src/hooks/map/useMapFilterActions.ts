import { useCallback } from 'react';
import {
  selectDiscoveryFilters,
  useDiscoveryFiltersStore,
} from '@/store';
import type { DatePreset } from '@/constants/filters';
import type { EventMetaFilter } from '@/utils/filter-events';
import {
  includesPast,
  toEventFilters,
  type DiscoveryFilters,
} from '@/utils/discovery-filters';
import { resolveViewportRefreshAfterFilter } from '@/utils/map-filter-transaction';
import { hasSearchCriteria as checkSearchCriteria } from '@/utils/search-helpers';
import type { ViewportFetchOptions } from './useViewportEventsFetch';

type ClientFilterOverrides = {
  metaFilter?: EventMetaFilter;
  searchFilters?: ReturnType<typeof toEventFilters>;
  searchApplied?: boolean;
  hasSearchCriteria?: boolean;
  includePast?: boolean;
};

type Params = {
  userLocation: { latitude: number; longitude: number } | null;
  discoveryStatus: EventMetaFilter;
  reapplyClientFilters: (options?: ClientFilterOverrides) => boolean;
  cancelViewportFetch: () => void;
  refreshBounds: (options?: Pick<ViewportFetchOptions, 'metaFilter'>) => Promise<void>;
  clearFrozenViewport: () => void;
};

/**
 * Single filter transaction path for map discovery controls.
 * Mutates discovery store, re-applies client filters on cached payload when possible,
 * otherwise cancels in-flight viewport work and refreshes bounds.
 */
export function useMapFilterActions({
  userLocation,
  discoveryStatus,
  reapplyClientFilters,
  cancelViewportFetch,
  refreshBounds,
  clearFrozenViewport,
}: Params) {
  const applySearchCriteria = useDiscoveryFiltersStore((s) => s.applySearchCriteria);
  const resetCriteria = useDiscoveryFiltersStore((s) => s.resetCriteria);

  const applyFilterTransaction = useCallback(
    (
      buildNext: (current: DiscoveryFilters) => DiscoveryFilters,
      options?: {
        metaFilter?: EventMetaFilter;
        forceRefresh?: boolean;
        previousMetaFilter?: EventMetaFilter;
      }
    ) => {
      const current = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
      const requestedFilters = buildNext(current);
      const nextHasSearchCriteria = checkSearchCriteria({
        place: requestedFilters.place,
        when: requestedFilters.when,
        content: requestedFilters.content,
      });
      const nextDiscoveryFilters = applySearchCriteria(
        {
          place: requestedFilters.place,
          when: requestedFilters.when,
          content: requestedFilters.content,
        },
        {
          status: requestedFilters.status,
          applied: nextHasSearchCriteria,
        }
      );
      const nextFilters = toEventFilters(nextDiscoveryFilters, userLocation);

      const metaFilter = options?.metaFilter ?? nextDiscoveryFilters.status;
      const reapplied = reapplyClientFilters({
        metaFilter,
        searchFilters: nextFilters,
        searchApplied: nextHasSearchCriteria,
        hasSearchCriteria: nextHasSearchCriteria,
        includePast: includesPast(nextDiscoveryFilters),
      });

      const previousMeta = options?.previousMetaFilter;
      const needsServerRefresh = resolveViewportRefreshAfterFilter({
        reapplied,
        metaFilter,
        previousMetaFilter: previousMeta,
        forceRefresh: options?.forceRefresh,
      });

      if (needsServerRefresh) {
        cancelViewportFetch();
        void refreshBounds({ metaFilter });
      }
    },
    [
      cancelViewportFetch,
      applySearchCriteria,
      reapplyClientFilters,
      refreshBounds,
      userLocation,
    ]
  );

  const handleWhenPresetChange = useCallback(
    (preset?: DatePreset) => {
      applyFilterTransaction(
        (current) => ({
          ...current,
          status: preset && current.status === 'past' ? 'all' : current.status,
          when: {
            preset,
            startDate: undefined,
            endDate: undefined,
            includePast: false,
          },
        }),
        // Date presets can require an upcoming server payload absent from the
        // current browse cache; client-side re-filtering alone is insufficient.
        { forceRefresh: true }
      );
    },
    [applyFilterTransaction]
  );

  const handleCategoriesChange = useCallback(
    (categories: string[], subcategories: string[]) => {
      applyFilterTransaction((current) => ({
        ...current,
        content: { ...current.content, categories, subcategories },
      }));
    },
    [applyFilterTransaction]
  );

  const handleMetaFilterChange = useCallback(
    (next: EventMetaFilter) => {
      const previous = discoveryStatus;
      clearFrozenViewport();
      applyFilterTransaction(
        (current) => ({
          ...current,
          status: next,
          when:
            next === 'past'
              ? { includePast: false }
              : next === 'all'
                ? current.when
                : { ...current.when, includePast: false },
        }),
        {
          metaFilter: next,
          previousMetaFilter: previous,
        }
      );
    },
    [applyFilterTransaction, clearFrozenViewport, discoveryStatus]
  );

  const handleResetFilters = useCallback(() => {
    clearFrozenViewport();
    resetCriteria();
    const next = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
    reapplyClientFilters({
      metaFilter: next.status,
      searchFilters: toEventFilters(next, userLocation),
      searchApplied: false,
      hasSearchCriteria: false,
      includePast: false,
    });
    cancelViewportFetch();
    void refreshBounds({ metaFilter: next.status });
  }, [
    cancelViewportFetch,
    clearFrozenViewport,
    reapplyClientFilters,
    refreshBounds,
    resetCriteria,
    userLocation,
  ]);

  return {
    handleWhenPresetChange,
    handleCategoriesChange,
    handleMetaFilterChange,
    handleResetFilters,
  };
}
