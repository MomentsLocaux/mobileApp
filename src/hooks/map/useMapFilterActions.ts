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
import { isDiscoverySearchActive } from '@/utils/map-discovery-contract';
import { hasSearchCriteria as checkSearchCriteria } from '@/utils/search-helpers';
import {
  defaultDiscoveryTemporalFilters,
  filtersForCustomDateRange,
  filtersForSearchTemporalChoice,
  type SearchTemporalChoice,
} from '@/utils/search-temporal-choice';
import type { DateRangeValue } from '@/types/eventDate.model';
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

function currentSearchFlags(filters: DiscoveryFilters) {
  const hasCriteria = checkSearchCriteria({
    place: filters.place,
    when: filters.when,
    content: filters.content,
  });
  const searchApplied = useDiscoveryFiltersStore.getState().searchApplied;
  return {
    hasCriteria,
    searchApplied,
    searchActive: isDiscoverySearchActive(searchApplied, hasCriteria),
  };
}

/**
 * Map discovery filter transactions.
 * Viewport refine (status / category / date) never sets searchApplied.
 * SearchBar Apply remains the only path that locks geography.
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
  const setStatus = useDiscoveryFiltersStore((s) => s.setStatus);
  const setContent = useDiscoveryFiltersStore((s) => s.setContent);
  const setWhen = useDiscoveryFiltersStore((s) => s.setWhen);
  const clearWhen = useDiscoveryFiltersStore((s) => s.clearWhen);

  const reapplyFromStore = useCallback(
    (options?: { metaFilter?: EventMetaFilter }) => {
      const next = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
      const flags = currentSearchFlags(next);
      const metaFilter = options?.metaFilter ?? next.status;
      return reapplyClientFilters({
        metaFilter,
        searchFilters: toEventFilters(next, userLocation),
        searchApplied: flags.searchApplied,
        hasSearchCriteria: flags.hasCriteria,
        includePast: includesPast(next),
      });
    },
    [reapplyClientFilters, userLocation]
  );

  const refreshIfNeeded = useCallback(
    (
      reapplied: boolean,
      options: {
        metaFilter: EventMetaFilter;
        previousMetaFilter?: EventMetaFilter;
        forceRefresh?: boolean;
      }
    ) => {
      const next = selectDiscoveryFilters(useDiscoveryFiltersStore.getState());
      const flags = currentSearchFlags(next);
      const needsServerRefresh = resolveViewportRefreshAfterFilter({
        reapplied,
        metaFilter: options.metaFilter,
        previousMetaFilter: options.previousMetaFilter,
        forceRefresh: options.forceRefresh,
        searchActive: flags.searchActive,
        includePast: includesPast(next),
      });
      if (needsServerRefresh) {
        cancelViewportFetch();
        void refreshBounds({ metaFilter: options.metaFilter });
      }
    },
    [cancelViewportFetch, refreshBounds]
  );

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

      refreshIfNeeded(reapplied, {
        metaFilter,
        previousMetaFilter: options?.previousMetaFilter,
        forceRefresh: options?.forceRefresh,
      });
    },
    [applySearchCriteria, reapplyClientFilters, refreshIfNeeded, userLocation]
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
        { forceRefresh: true }
      );
    },
    [applyFilterTransaction]
  );

  const handleTemporalChoice = useCallback(
    (choice: SearchTemporalChoice) => {
      const previous = discoveryStatus;
      const next = filtersForSearchTemporalChoice(choice);
      const isDatePreset =
        choice === 'today' || choice === 'tomorrow' || choice === 'weekend';
      clearFrozenViewport();
      setStatus(next.status);
      if (next.when.preset) {
        setWhen({
          preset: next.when.preset,
          startDate: undefined,
          endDate: undefined,
          includePast: false,
        });
      } else {
        clearWhen();
      }
      const reapplied = reapplyFromStore({ metaFilter: next.status });
      refreshIfNeeded(reapplied, {
        metaFilter: next.status,
        previousMetaFilter: previous,
        forceRefresh: isDatePreset,
      });
    },
    [
      clearFrozenViewport,
      clearWhen,
      discoveryStatus,
      reapplyFromStore,
      refreshIfNeeded,
      setStatus,
      setWhen,
    ]
  );

  const handleCustomDateChange = useCallback(
    (range: DateRangeValue) => {
      const previous = discoveryStatus;
      const next = filtersForCustomDateRange(range);
      clearFrozenViewport();
      setStatus(next.status);
      setWhen({
        preset: next.when.preset,
        startDate: next.when.startDate,
        endDate: next.when.endDate,
        includePast: next.when.includePast === true,
      });
      const reapplied = reapplyFromStore({ metaFilter: next.status });
      refreshIfNeeded(reapplied, {
        metaFilter: next.status,
        previousMetaFilter: previous,
        forceRefresh: true,
      });
    },
    [
      clearFrozenViewport,
      discoveryStatus,
      reapplyFromStore,
      refreshIfNeeded,
      setStatus,
      setWhen,
    ]
  );

  const handleCategoriesChange = useCallback(
    (categories: string[], subcategories: string[]) => {
      clearFrozenViewport();
      setContent({ categories, subcategories });
      const reapplied = reapplyFromStore();
      refreshIfNeeded(reapplied, {
        metaFilter: useDiscoveryFiltersStore.getState().status,
      });
    },
    [clearFrozenViewport, reapplyFromStore, refreshIfNeeded, setContent]
  );

  const handleMetaFilterChange = useCallback(
    (next: EventMetaFilter) => {
      const previous = discoveryStatus;
      clearFrozenViewport();
      setStatus(next);
      const reapplied = reapplyFromStore({ metaFilter: next });
      refreshIfNeeded(reapplied, {
        metaFilter: next,
        previousMetaFilter: previous,
      });
    },
    [clearFrozenViewport, discoveryStatus, reapplyFromStore, refreshIfNeeded, setStatus]
  );

  const handleClearViewportFilters = useCallback(() => {
    const previous = discoveryStatus;
    const next = defaultDiscoveryTemporalFilters();
    clearFrozenViewport();
    setContent({ categories: [], subcategories: [] });
    setWhen({
      preset: next.when.preset,
      startDate: undefined,
      endDate: undefined,
      includePast: false,
    });
    setStatus(next.status);
    const reapplied = reapplyFromStore({ metaFilter: next.status });
    refreshIfNeeded(reapplied, {
      metaFilter: next.status,
      previousMetaFilter: previous,
      forceRefresh: true,
    });
  }, [
    clearFrozenViewport,
    discoveryStatus,
    reapplyFromStore,
    refreshIfNeeded,
    setContent,
    setStatus,
    setWhen,
  ]);

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
    handleTemporalChoice,
    handleCustomDateChange,
    handleCategoriesChange,
    handleMetaFilterChange,
    handleClearViewportFilters,
    handleResetFilters,
  };
}
