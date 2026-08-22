import { useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '../store';

export const useLocation = () => {
  const {
    currentLocation,
    permissionGranted,
    isLoading,
    error,
    setCurrentLocation,
    setPermissionGranted,
    setLoading,
    setError,
  } = useLocationStore();

  const getCurrentLocation = useCallback(async () => {
    const hadFix = !!useLocationStore.getState().currentLocation;
    if (!hadFix) {
      setLoading(true);
    }
    setError(null);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
      return location;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setCurrentLocation, setError, setLoading]);

  const requestLocationPermission = useCallback(async () => {
    const { currentLocation: existing, permissionGranted: alreadyGranted } =
      useLocationStore.getState();
    const softRefresh = alreadyGranted && !!existing;
    if (!softRefresh) {
      setLoading(true);
    }
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(status === 'granted');

      if (status === 'granted') {
        // A recent cached fix is sufficient to render nearby results immediately;
        // the high-accuracy refresh continues before the loading cycle completes.
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 1000,
        });
        if (lastKnown) {
          setCurrentLocation(lastKnown);
          setLoading(false);
        }
        await getCurrentLocation();
      } else {
        setError('Location permission denied');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request permission');
    } finally {
      setLoading(false);
    }
  }, [getCurrentLocation, setCurrentLocation, setError, setLoading, setPermissionGranted]);

  useEffect(() => {
    void requestLocationPermission();
  }, [requestLocationPermission]);

  return {
    currentLocation,
    permissionGranted,
    isLoading,
    error,
    requestPermission: requestLocationPermission,
    refreshLocation: getCurrentLocation,
  };
};
