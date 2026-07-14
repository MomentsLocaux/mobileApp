import { useCallback, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';
import { DISCOVERY_CAPTURE_ENABLED, DISCOVERY_ENABLED } from '@/config/discovery.flags';
import { useDiscoveryConsent } from '@/hooks/useDiscoveryConsent';
import { DiscoverySyncService } from '@/services/discovery/discovery-sync.service';
import {
  startDiscoveryBackgroundCapture,
  stopDiscoveryBackgroundCapture,
} from '@/tasks/discovery-location';

export function useDiscoveryCapture(userId?: string | null) {
  const { consent, isEnabled, refresh } = useDiscoveryConsent();
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureAllowed =
    DISCOVERY_ENABLED &&
    DISCOVERY_CAPTURE_ENABLED &&
    !!userId &&
    isEnabled &&
    consent?.location_enabled === true;

  const stopCapture = useCallback(async () => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    await stopDiscoveryBackgroundCapture();
  }, []);

  const startCapture = useCallback(async () => {
    if (!captureAllowed) {
      await stopCapture();
      return;
    }

    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.status !== 'granted') return;
    }

    const background = await Location.getBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      const requestedBackground = await Location.requestBackgroundPermissionsAsync();
      if (requestedBackground.status !== 'granted') return;
    }

    await startDiscoveryBackgroundCapture();

    if (!syncTimerRef.current) {
      syncTimerRef.current = setInterval(() => {
        DiscoverySyncService.syncIfDue().catch(() => undefined);
      }, 15 * 60 * 1000);
    }
  }, [captureAllowed, stopCapture]);

  useEffect(() => {
    if (!captureAllowed) {
      stopCapture();
      return;
    }

    startCapture().catch((error) => {
      console.warn('[useDiscoveryCapture] start failed', error);
    });

    return () => {
      stopCapture().catch(() => undefined);
    };
  }, [captureAllowed, startCapture, stopCapture]);

  useEffect(() => {
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active' && captureAllowed) {
        DiscoverySyncService.syncIfDue().catch(() => undefined);
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [captureAllowed]);

  return {
    consent,
    captureAllowed,
    refreshConsent: refresh,
    startCapture,
    stopCapture,
  };
}

export async function requestDiscoveryLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}
