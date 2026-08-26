import { useCallback, useRef, useState } from 'react';
import type { MapBounds } from '@/types/map-events';
import { hasLeftSearchedZone } from '@/utils/map-search-this-area';

type Params = {
  /** Fetch the given bbox (immediate force). */
  searchBounds: (bounds: MapBounds) => void;
  getZoom: () => number;
};

/**
 * Airbnb / Google Maps “search this area” gate for map browse.
 * Auto-search is owned by bootstrap / recenter / filter apply (call markZoneSearched
 * after those fetches). User pan/zoom only updates the chip.
 */
export function useSearchThisArea({ searchBounds, getZoom }: Params) {
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const searchedBoundsRef = useRef<MapBounds | null>(null);
  const searchedZoomRef = useRef<number | null>(null);
  const pendingBoundsRef = useRef<MapBounds | null>(null);

  const markZoneSearched = useCallback(
    (bounds: MapBounds, zoom?: number | null) => {
      searchedBoundsRef.current = bounds;
      searchedZoomRef.current =
        typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : getZoom();
      pendingBoundsRef.current = bounds;
      setShowSearchThisArea(false);
    },
    [getZoom]
  );

  const onUserCameraSettled = useCallback(
    (bounds: MapBounds, zoom?: number | null) => {
      pendingBoundsRef.current = bounds;
      const currentZoom =
        typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : getZoom();
      const shouldShow = hasLeftSearchedZone(searchedBoundsRef.current, bounds, {
        searchedZoom: searchedZoomRef.current,
        currentZoom,
      });
      setShowSearchThisArea(shouldShow);
    },
    [getZoom]
  );

  const searchThisArea = useCallback(() => {
    const bounds = pendingBoundsRef.current ?? searchedBoundsRef.current;
    if (!bounds) return;
    setShowSearchThisArea(false);
    searchBounds(bounds);
    markZoneSearched(bounds);
  }, [markZoneSearched, searchBounds]);

  const dismissSearchThisArea = useCallback(() => {
    setShowSearchThisArea(false);
  }, []);

  return {
    showSearchThisArea,
    markZoneSearched,
    onUserCameraSettled,
    searchThisArea,
    dismissSearchThisArea,
  };
}
