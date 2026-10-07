import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  SETTINGS_TOUR_COPY,
  SETTINGS_TOUR_ID,
  settingsTourFireAt,
} from '@/utils/settings-tour-reminder';

const FIRST_OPEN_KEY = 'ml.settingsTour.firstOpenAt';
const STATE_KEY = 'ml.settingsTour.state';

type TourState =
  | { status: 'scheduled'; fireAt: string }
  | { status: 'skipped' }
  | { status: 'done' };

/**
 * Anchors J+1 to the onboarding of this install. Existing accounts that
 * already finished onboarding are not written, so an update does not
 * notify the whole installed base the next morning.
 */
export async function rememberAppFirstOpen(now = new Date()): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const existing = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (existing) return;
    await AsyncStorage.setItem(FIRST_OPEN_KEY, now.toISOString());
  } catch (error) {
    console.warn('[push] settings tour first-open failed', error);
  }
}

const readState = async (): Promise<TourState | null> => {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as TourState;
  if (parsed?.status === 'scheduled' && typeof parsed.fireAt === 'string') return parsed;
  if (parsed?.status === 'skipped' || parsed?.status === 'done') return parsed;
  return null;
};

const writeState = async (state: TourState) => {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
};

/**
 * One local notification at 10:00 the morning after install.
 * Scheduled on the device so it does not depend on a server cron or a push token.
 * No-op until the system notification permission is already granted.
 */
export async function scheduleSettingsTourReminder(now = new Date()): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const stored = await readState();
    if (stored?.status === 'skipped' || stored?.status === 'done') return;

    const firstOpenRaw = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (!firstOpenRaw && stored?.status !== 'scheduled') return;

    const Notifications = await import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return;

    if (stored?.status === 'scheduled') {
      const fireAt = new Date(stored.fireAt);
      if (fireAt.getTime() <= now.getTime()) {
        await writeState({ status: 'done' });
        return;
      }
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      if (pending.some((item) => item.identifier === SETTINGS_TOUR_ID)) return;
    }

    const firstOpenAt = firstOpenRaw ? new Date(firstOpenRaw) : now;
    const fireAt =
      stored?.status === 'scheduled' ? new Date(stored.fireAt) : settingsTourFireAt(firstOpenAt, now);
    if (!fireAt || fireAt.getTime() <= now.getTime()) {
      await writeState({ status: 'skipped' });
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Général',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.cancelScheduledNotificationAsync(SETTINGS_TOUR_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: SETTINGS_TOUR_ID,
      content: {
        title: SETTINGS_TOUR_COPY.title,
        body: SETTINGS_TOUR_COPY.body,
        data: {
          type: 'system',
          route: 'notification_settings',
          kind: 'settings_tour_j1',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: 'default',
      },
    });
    await writeState({ status: 'scheduled', fireAt: fireAt.toISOString() });
  } catch (error) {
    console.warn('[push] settings tour schedule failed', error);
  }
}
