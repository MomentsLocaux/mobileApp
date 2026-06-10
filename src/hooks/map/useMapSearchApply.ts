import { useCallback } from 'react';
import { resolveEffectiveRadiusKm } from '@/utils/search-helpers';
import type { SearchState } from '@/store/searchStore';

type UserLocation = { latitude: number; longitude: number } | null;

type Params = {
  searchState: SearchState;
  userLocation: UserLocation;
  setMetaFilter: (filter: 'all') => void;
  commitSearch: () => void;
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
  searchState: SearchState,
  userLocation: UserLocation
): SearchTargetBounds | null {
  const location = searchState.where.location;
  const effectiveRadius = resolveEffectiveRadiusKm(searchState.where, userLocation) ?? 10;

  if (location) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: effectiveRadius,
    };
  }

  if (searchState.where.radiusKm !== undefined && userLocation) {
    return {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      radiusKm: effectiveRadius,
    };
  }

  return null;
}

export function useMapSearchApply({
  searchState,
  userLocation,
  setMetaFilter,
  commitSearch,
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
    setMetaFilter('all');
    commitSearch();
    setStatus('loading');

    const targetBounds = resolveSearchTargetBounds(searchState, userLocation);
    if (targetBounds) {
      moveMapToSearchBounds(targetBounds);
      return;
    }

    void refreshBounds();
  }, [
    commitSearch,
    moveMapToSearchBounds,
    refreshBounds,
    searchState,
    setMetaFilter,
    setStatus,
    userLocation,
  ]);

  return { applySearch, resolveSearchTargetBounds, moveMapToSearchBounds };
}
