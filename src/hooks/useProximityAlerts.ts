import { useCallback, useEffect } from 'react';
import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';
import { PreferencesService } from '@/services/preferences.service';
import { ProximityAlertService } from '@/services/proximity-alert.service';
import {
  startProximityBackgroundAlerts,
  stopProximityBackgroundAlerts,
} from '@/tasks/proximity-location';

/**
 * Starts sparse background location updates only when `notify_proximity_live`
 * is on and Always permission is granted. Distinct from Discovery capture.
 */
export function useProximityAlerts(userId?: string | null) {
  const stopAlerts = useCallback(async () => {
    await stopProximityBackgroundAlerts();
  }, []);

  const syncAlerts = useCallback(async () => {
    if (!userId) {
      await stopAlerts();
      return;
    }

    let enabled = false;
    try {
      const prefs = await PreferencesService.getMine(userId);
      enabled = prefs.notify_proximity_live === true;
    } catch {
      await stopAlerts();
      return;
    }

    if (!enabled) {
      await stopAlerts();
      return;
    }

    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      await stopAlerts();
      return;
    }

    const background = await Location.getBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      await stopAlerts();
      return;
    }

    await startProximityBackgroundAlerts();

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await ProximityAlertService.reportIfDue({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch {
      // background task remains the primary path
    }
  }, [stopAlerts, userId]);

  useEffect(() => {
    syncAlerts().catch((error) => {
      console.warn('[useProximityAlerts] sync failed', error);
    });

    return () => {
      // Do not stop on unmount of root layout — only when pref/user changes.
    };
  }, [syncAlerts]);

  useEffect(() => {
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        syncAlerts().catch(() => undefined);
      }
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [syncAlerts]);

  return { syncAlerts, stopAlerts };
}

/** Request When-In-Use then Always. Returns true only if background is granted. */
export async function requestProximityLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}
