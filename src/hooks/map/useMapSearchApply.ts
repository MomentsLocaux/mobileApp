import { useCallback } from 'react';
import { resolveEffectiveRadiusKm, resolveSearchCenter } from '@/utils/search-helpers';
import type { DiscoveryFilters } from '@/utils/discovery-filters';

type UserLocation = { latitude: number; longitude: number } | null;

type Params = {
  filters: DiscoveryFilters;
  userLocation: UserLocation;
  syncSearchState: () => void;
  setStatus: (status: 'loading') => void;
  fitToRadius: (latitude: number, longitude: number, radiusKm: number) => unknown;
  refreshBounds: () => Promise<void>;
};

type SearchTargetBounds = {
  latitude: number;
  longitude: number;
  radiusKm: number;
};

function resolveSearchTargetBounds(
  filters: DiscoveryFilters,
  userLocation: UserLocation
): SearchTargetBounds | null {
  const center = resolveSearchCenter(filters.place, userLocation);
  const effectiveRadius = resolveEffectiveRadiusKm(filters.place, userLocation);
  if (!center || effectiveRadius === undefined) return null;

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    radiusKm: effectiveRadius,
  };
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
    (target: SearchTargetBounds) => {
      fitToRadius(target.latitude, target.longitude, target.radiusKm);
    },
    [fitToRadius]
  );

  const applySearch = useCallback(() => {
    // SearchBar commits the shared lifecycle before invoking this callback.
    syncSearchState();
    setStatus('loading');

    const targetBounds = resolveSearchTargetBounds(filters, userLocation);
    if (targetBounds) {
      moveMapToSearchBounds(targetBounds);
      return;
    }

    void refreshBounds();
  }, [
    filters,
    moveMapToSearchBounds,
    refreshBounds,
    setStatus,
    syncSearchState,
    userLocation,
  ]);

  return { applySearch, resolveSearchTargetBounds, moveMapToSearchBounds };
}
