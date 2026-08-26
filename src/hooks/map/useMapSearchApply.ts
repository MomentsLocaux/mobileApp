import { useCallback } from 'react';
import { clampMapRecenterRadiusKm } from '@/constants/map-screen';
import type { MapBounds } from '@/types/map-events';
import {
  resolveSearchTargetBounds,
  type SearchTargetBounds,
} from '@/utils/search-helpers';
import type { DiscoveryFilters } from '@/utils/discovery-filters';

type UserLocation = { latitude: number; longitude: number } | null;

type Params = {
  filters: DiscoveryFilters;
  userLocation: UserLocation;
  syncSearchState: () => void;
  setStatus: (status: 'loading') => void;
  fitToRadius: (latitude: number, longitude: number, radiusKm: number) => MapBounds;
  refreshBounds: () => Promise<void>;
};

export type { SearchTargetBounds };
export { resolveSearchTargetBounds };

/** Adapter: full discovery filters → place/radius camera target. */
export function resolveDiscoverySearchTargetBounds(
  filters: DiscoveryFilters,
  userLocation: UserLocation
): SearchTargetBounds | null {
  return resolveSearchTargetBounds(filters.place, userLocation);
}

export function useMapSearchApply({
  filters,
  userLocation,
  syncSearchState,
  setStatus,
  fitToRadius,
  refreshBounds,
}: Params) {
  const moveMapToSearchBounds = useCallback(
    (target: SearchTargetBounds): MapBounds =>
      fitToRadius(
        target.latitude,
        target.longitude,
        clampMapRecenterRadiusKm(target.radiusKm)
      ),
    [fitToRadius]
  );

  const applySearch = useCallback((): MapBounds | null => {
    // SearchBar commits the shared lifecycle before invoking this callback.
    syncSearchState();
    setStatus('loading');

    const targetBounds = resolveDiscoverySearchTargetBounds(filters, userLocation);
    if (targetBounds) {
      return moveMapToSearchBounds(targetBounds);
    }

    void refreshBounds();
    return null;
  }, [
    filters,
    moveMapToSearchBounds,
    refreshBounds,
    setStatus,
    syncSearchState,
    userLocation,
  ]);

  return {
    applySearch,
    resolveSearchTargetBounds: resolveDiscoverySearchTargetBounds,
    moveMapToSearchBounds,
  };
}
