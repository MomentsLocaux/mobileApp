import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { DiscoveryCaptureService } from '@/services/discovery/discovery-capture.service';
import { DiscoverySyncService } from '@/services/discovery/discovery-sync.service';
import { DISCOVERY_CAPTURE_CONFIG, DISCOVERY_CAPTURE_TASK } from '@/services/discovery/discovery-capture.types';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

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

export async function isDiscoveryCaptureRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(DISCOVERY_CAPTURE_TASK);
}

export async function startDiscoveryBackgroundCapture(): Promise<void> {
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
  const started = await isDiscoveryCaptureRunning();
  if (!started) return;
  await Location.stopLocationUpdatesAsync(DISCOVERY_CAPTURE_TASK);
}
