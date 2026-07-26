import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROXIMITY_ALERT_CONFIG } from '@/constants/proximity-alert';
import { supabase } from '@/lib/supabase/client';

const LAST_CHECK_KEY = 'proximity_alert:last_check';

type LastCheck = {
  at: number;
  latitude: number;
  longitude: number;
};

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function readLastCheck(): Promise<LastCheck | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastCheck;
    if (
      typeof parsed?.at !== 'number' ||
      typeof parsed?.latitude !== 'number' ||
      typeof parsed?.longitude !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeLastCheck(check: LastCheck): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, JSON.stringify(check));
  } catch {
    // non-fatal
  }
}

/**
 * Reports the device position to Supabase; server decides whether to enqueue
 * `event_nearby_live` (prefs, themes, 24h anti-dupe). Coordinates are not stored.
 */
export const ProximityAlertService = {
  async reportIfDue(coords: { latitude: number; longitude: number }): Promise<number> {
    const now = Date.now();
    const last = await readLastCheck();
    if (last) {
      if (now - last.at < PROXIMITY_ALERT_CONFIG.minIntervalMs) {
        return 0;
      }
      const moved = haversineMeters(last, coords);
      if (moved < PROXIMITY_ALERT_CONFIG.minMoveMeters) {
        return 0;
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return 0;

    const { data, error } = await supabase.rpc('report_proximity_live_alerts', {
      p_lat: coords.latitude,
      p_lon: coords.longitude,
      p_radius_m: PROXIMITY_ALERT_CONFIG.radiusMeters,
      p_soon_hours: PROXIMITY_ALERT_CONFIG.soonHours,
    });

    await writeLastCheck({
      at: now,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    if (error) {
      console.warn('[proximity-alert] report failed', error.message);
      return 0;
    }

    return typeof data === 'number' ? data : 0;
  },

  async clearLocalThrottle(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_CHECK_KEY);
    } catch {
      // non-fatal
    }
  },
};
