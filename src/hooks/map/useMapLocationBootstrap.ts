import { useCallback, useEffect, useRef } from 'react';

type UserLocation = { latitude: number; longitude: number } | null;

type Params = {
  userLocation: UserLocation;
  locationLoading: boolean;
  recenterToUser: () => void;
  refreshBounds: () => Promise<void>;
  ensureInitialViewportLoad: () => Promise<void>;
  disabled?: boolean;
};

/**
 * Centers the map on the user once, then ensures an initial viewport fetch.
 * Falls back to ensureInitialViewportLoad when GPS is unavailable.
 */
export function useMapLocationBootstrap({
  userLocation,
  locationLoading,
  recenterToUser,
  refreshBounds,
  ensureInitialViewportLoad,
  disabled = false,
}: Params) {
  const hasCenteredOnUserRef = useRef(false);
  const recenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRecenterTimer = useCallback(() => {
    if (recenterTimerRef.current) {
      clearTimeout(recenterTimerRef.current);
      recenterTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearRecenterTimer(), [clearRecenterTimer]);

  useEffect(() => {
    if (disabled) {
      // A transferred/applied search owns the initial camera. Mark the regular
      // location bootstrap consumed so clearing that search cannot snap back.
      hasCenteredOnUserRef.current = true;
      clearRecenterTimer();
      return;
    }
    if (userLocation && !hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      recenterToUser();
      clearRecenterTimer();
      recenterTimerRef.current = setTimeout(() => {
        recenterTimerRef.current = null;
        void refreshBounds();
      }, 700);
      return;
    }
    if (locationLoading) return;
    void ensureInitialViewportLoad();
  }, [
    clearRecenterTimer,
    disabled,
    ensureInitialViewportLoad,
    locationLoading,
    recenterToUser,
    refreshBounds,
    userLocation,
  ]);
}
