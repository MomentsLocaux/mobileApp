import { useEffect, useRef } from 'react';

type UserLocation = { latitude: number; longitude: number } | null;

type Params = {
  userLocation: UserLocation;
  locationLoading: boolean;
  mapReady: boolean;
  recenterToUser: () => void;
  ensureInitialViewportLoad: () => Promise<void>;
  disabled?: boolean;
  /** Country overview: wait for zoom or an explicit place instead of fetching France. */
  bootstrapViewportFetch?: boolean;
};

/**
 * Centers the map on the user once after Mapbox is ready.
 * Fetch is triggered by the programmatic recenter (`refreshAfter: true`).
 * Without GPS, a searched place can still bootstrap a viewport fetch;
 * a country overview waits for zoom or SearchBar.
 */
export function useMapLocationBootstrap({
  userLocation,
  locationLoading,
  mapReady,
  recenterToUser,
  ensureInitialViewportLoad,
  disabled = false,
  bootstrapViewportFetch = true,
}: Params) {
  const hasCenteredOnUserRef = useRef(false);

  useEffect(() => {
    if (!mapReady) return;
    if (disabled) {
      // A transferred/applied search owns the initial camera. Mark the regular
      // location bootstrap consumed so clearing that search cannot snap back.
      hasCenteredOnUserRef.current = true;
      return;
    }
    if (userLocation && !hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      recenterToUser();
      return;
    }
    if (locationLoading) return;
    if (hasCenteredOnUserRef.current) return;
    if (!bootstrapViewportFetch) return;
    void ensureInitialViewportLoad();
  }, [
    bootstrapViewportFetch,
    disabled,
    ensureInitialViewportLoad,
    locationLoading,
    mapReady,
    recenterToUser,
    userLocation,
  ]);
}
