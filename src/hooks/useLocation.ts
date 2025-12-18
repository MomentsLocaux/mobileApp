import { useEffect } from 'react';
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

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[useLocation] permission status =', status);
      setPermissionGranted(status === 'granted');

      if (status === 'granted') {
        await getCurrentLocation();
      } else {
        setError('Location permission denied');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request permission');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      console.log('[useLocation] current position =', {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });
      setCurrentLocation(location);
      return location;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentLocation,
    permissionGranted,
    isLoading,
    error,
    requestPermission: requestLocationPermission,
    refreshLocation: getCurrentLocation,
  };
};
