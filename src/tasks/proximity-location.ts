import { PROXIMITY_ALERT_CONFIG, PROXIMITY_ALERT_TASK } from '@/constants/proximity-alert';
import { ProximityAlertService } from '@/services/proximity-alert.service';
import { isProximityAlertNativeAvailable } from '@/tasks/proximity-location.support';

let taskRegistered = false;

type LocationTaskData = {
  locations?: {
    coords: { latitude: number; longitude: number };
    timestamp: number;
  }[];
};

function warnNativeUnavailable(action: string): void {
  console.warn(
    `[proximity-alert] ${action} skipped — native TaskManager unavailable. ` +
      'Use a dev build (`npx expo run:ios` / `run:android`).',
  );
}

/** Must run once at app startup (global scope), before background updates start. */
export function ensureProximityLocationTaskRegistered(): void {
  if (taskRegistered || !isProximityAlertNativeAvailable()) return;

  try {
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');

    TaskManager.defineTask(PROXIMITY_ALERT_TASK, async ({ data, error }) => {
      if (error) {
        console.warn('[proximity-alert] task error', error.message);
        return;
      }

      const locations = (data as LocationTaskData | undefined)?.locations ?? [];
      const latest = locations[locations.length - 1];
      if (!latest) return;

      try {
        await ProximityAlertService.reportIfDue({
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
        });
      } catch (reportError) {
        console.warn('[proximity-alert] report failed', reportError);
      }
    });

    taskRegistered = true;
  } catch (error) {
    console.warn('[proximity-alert] failed to register background task', error);
  }
}

export async function isProximityAlertRunning(): Promise<boolean> {
  if (!isProximityAlertNativeAvailable()) return false;

  try {
    const Location = require('expo-location') as typeof import('expo-location');
    return Location.hasStartedLocationUpdatesAsync(PROXIMITY_ALERT_TASK);
  } catch {
    return false;
  }
}

export async function startProximityBackgroundAlerts(): Promise<void> {
  if (!isProximityAlertNativeAvailable()) {
    warnNativeUnavailable('start');
    return;
  }

  ensureProximityLocationTaskRegistered();

  const Location = require('expo-location') as typeof import('expo-location');
  const started = await isProximityAlertRunning();
  if (started) return;

  await Location.startLocationUpdatesAsync(PROXIMITY_ALERT_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: PROXIMITY_ALERT_CONFIG.distanceIntervalMeters,
    deferredUpdatesInterval: PROXIMITY_ALERT_CONFIG.minIntervalMs,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Moments Locaux',
      notificationBody: 'Alertes quand un moment est en cours ou bientôt près de vous.',
    },
    pausesUpdatesAutomatically: true,
  });
}

export async function stopProximityBackgroundAlerts(): Promise<void> {
  if (!isProximityAlertNativeAvailable()) return;

  try {
    const Location = require('expo-location') as typeof import('expo-location');
    const started = await isProximityAlertRunning();
    if (!started) return;
    await Location.stopLocationUpdatesAsync(PROXIMITY_ALERT_TASK);
  } catch (error) {
    console.warn('[proximity-alert] stop failed', error);
  }
}
