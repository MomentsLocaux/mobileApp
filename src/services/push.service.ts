import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

let handlerConfigured = false;

/**
 * Foreground presentation of incoming push notifications.
 * Must run once, as early as possible (module import / root layout).
 */
export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Général',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function getProjectId(): string | undefined {
  const easConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig;
  return Constants.expoConfig?.extra?.eas?.projectId || easConfig?.projectId || undefined;
}

/**
 * Requests notification permission, obtains the Expo push token and stores it
 * in device_push_tokens. Returns the token, or null when unavailable
 * (permission denied, simulator, web, or missing EAS projectId).
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    await ensureAndroidChannel();

    const projectId = getProjectId();
    if (!projectId) {
      console.warn(
        '[push] Missing EAS projectId — run `eas init` and set EAS_PROJECT_ID; skipping token registration.',
      );
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const { error } = await supabase
      .from('device_push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          device_name: Constants.deviceName ?? null,
          last_seen_at: new Date().toISOString(),
        } as never,
        { onConflict: 'token' },
      );
    if (error) {
      console.warn('[push] Failed to persist device token:', error.message);
      return null;
    }
    return token;
  } catch (e) {
    console.warn('[push] registerForPushNotificationsAsync error:', e);
    return null;
  }
}

/** Best-effort removal of this device's token, e.g. on sign-out. */
export async function unregisterCurrentDevice(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const projectId = getProjectId();
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await supabase.from('device_push_tokens').delete().eq('token', token);
  } catch (e) {
    console.warn('[push] unregisterCurrentDevice error:', e);
  }
}

/**
 * Snapshots the current device position into user_preferences.home_location so
 * the server-side "nearby" notifications can target this user. A foreground
 * ("while using the app") permission is enough — no background location.
 *
 * @param prompt when false, only refreshes if permission was already granted
 *               (no system dialog); when true, may request permission.
 */
export async function syncHomeLocation({ prompt }: { prompt: boolean }): Promise<boolean> {
  try {
    let status = (await Location.getForegroundPermissionsAsync()).status;
    if (status !== 'granted') {
      if (!prompt) return false;
      status = (await Location.requestForegroundPermissionsAsync()).status;
    }
    if (status !== 'granted') return false;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = pos.coords;

    const { error } = await supabase.rpc('set_home_location', {
      p_lat: latitude,
      p_lon: longitude,
    });
    if (error) {
      console.warn('[push] set_home_location failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[push] syncHomeLocation error:', e);
    return false;
  }
}

/** Removes the stored reference point (e.g. when the user disables nearby alerts). */
export async function clearHomeLocation(): Promise<void> {
  try {
    await supabase.rpc('clear_home_location');
  } catch (e) {
    console.warn('[push] clearHomeLocation error:', e);
  }
}

/** Deep-links a notification tap to the relevant in-app screen. */
export function routeFromNotificationData(data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  const eventId = (d.eventId ?? d.event_id) as string | undefined;
  if (eventId) {
    router.push(`/events/${eventId}`);
    return;
  }
  router.push('/notifications');
}
