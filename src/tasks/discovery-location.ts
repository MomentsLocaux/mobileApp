import { DiscoveryCaptureService } from '@/services/discovery/discovery-capture.service';
import { DiscoverySyncService } from '@/services/discovery/discovery-sync.service';
import { DISCOVERY_CAPTURE_CONFIG, DISCOVERY_CAPTURE_TASK } from '@/services/discovery/discovery-capture.types';
import { isDiscoveryCaptureNativeAvailable } from '@/tasks/discovery-location.support';

let taskRegistered = false;

type LocationTaskData = {
  locations?: {
    coords: { latitude: number; longitude: number; speed: number | null };
    timestamp: number;
  }[];
};

function warnNativeUnavailable(action: string): void {
  console.warn(
    `[discovery-capture] ${action} skipped — native TaskManager unavailable. ` +
      'Use a dev build (`npx expo run:ios` / `run:android`) after enabling capture.',
  );
}

/** Must run once at app startup (global scope), before background updates start. */
export function ensureDiscoveryLocationTaskRegistered(): void {
  if (taskRegistered || !isDiscoveryCaptureNativeAvailable()) return;

  try {
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');

    TaskManager.defineTask(DISCOVERY_CAPTURE_TASK, async ({ data, error }) => {
      if (error) {
        console.warn('[discovery-capture] task error', error.message);
        return;
      }

      const locations = (data as LocationTaskData | undefined)?.locations ?? [];
      for (const location of locations) {
        await DiscoveryCaptureService.recordSample({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          recordedAt: new Date(location.timestamp).toISOString(),
          speedMps: location.coords.speed,
        });
      }

      try {
        await DiscoverySyncService.syncIfDue();
      } catch (syncError) {
        console.warn('[discovery-capture] sync failed', syncError);
      }
    });

    taskRegistered = true;
  } catch (error) {
    console.warn('[discovery-capture] failed to register background task', error);
  }
}

export async function isDiscoveryCaptureRunning(): Promise<boolean> {
  if (!isDiscoveryCaptureNativeAvailable()) return false;

  try {
    const Location = require('expo-location') as typeof import('expo-location');
    return Location.hasStartedLocationUpdatesAsync(DISCOVERY_CAPTURE_TASK);
  } catch {
    return false;
  }
}

export async function startDiscoveryBackgroundCapture(): Promise<void> {
  if (!isDiscoveryCaptureNativeAvailable()) {
    warnNativeUnavailable('start');
    return;
  }

  ensureDiscoveryLocationTaskRegistered();

  const Location = require('expo-location') as typeof import('expo-location');
  const started = await isDiscoveryCaptureRunning();
  if (started) return;

  await Location.startLocationUpdatesAsync(DISCOVERY_CAPTURE_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: DISCOVERY_CAPTURE_CONFIG.sampleIntervalMs,
    distanceInterval: DISCOVERY_CAPTURE_CONFIG.distanceIntervalMeters,
    deferredUpdatesInterval: DISCOVERY_CAPTURE_CONFIG.sampleIntervalMs,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Moments Locaux',
      notificationBody: 'Discovery observe les lieux visités pour enrichir vos suggestions.',
    },
    pausesUpdatesAutomatically: true,
  });
}

export async function stopDiscoveryBackgroundCapture(): Promise<void> {
  if (!isDiscoveryCaptureNativeAvailable()) return;

  try {
    const Location = require('expo-location') as typeof import('expo-location');
    const started = await isDiscoveryCaptureRunning();
    if (!started) return;
    await Location.stopLocationUpdatesAsync(DISCOVERY_CAPTURE_TASK);
  } catch (error) {
    console.warn('[discovery-capture] stop failed', error);
  }
}
