import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { getEventShareUrl } from './event-share';
import {
  buildCalendarNotes,
  buildGoogleCalendarUrl,
  resolveCalendarDates,
  type CalendarEventInput,
} from './event-calendar-format';

export const EVENT_CALENDAR_LABEL = 'Je note la date';

export type { CalendarEventInput };
export type AddToCalendarOutcome = 'saved' | 'canceled' | 'opened';
export {
  buildGoogleCalendarUrl,
  formatCalendarLocalStamp,
  resolveCalendarDates,
} from '@/utils/event-calendar-format';

type ExpoCalendarModule = typeof import('expo-calendar');

/** True only after a native rebuild that autolinks expo-calendar. */
export function isNativeCalendarAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return requireOptionalNativeModule('ExpoCalendar') != null;
  } catch {
    return false;
  }
}

async function loadExpoCalendar(): Promise<ExpoCalendarModule | null> {
  if (!isNativeCalendarAvailable()) return null;
  try {
    return await import('expo-calendar');
  } catch (error) {
    console.warn('[calendar] expo-calendar JS failed to load', error);
    return null;
  }
}

async function openGoogleCalendarFallback(input: CalendarEventInput): Promise<AddToCalendarOutcome> {
  const url = buildGoogleCalendarUrl(input);
  if (!url) return 'canceled';
  await Linking.openURL(url);
  return 'opened';
}

/**
 * Opens the OS calendar composer with the event pre-filled.
 * The app does not write the agenda itself. Falls back to Google Calendar
 * when the native module is missing (Expo Go / stale dev client).
 */
export async function presentAddToDeviceCalendar(
  input: CalendarEventInput,
): Promise<AddToCalendarOutcome> {
  const dates = resolveCalendarDates(input.startsAt, input.endsAt);
  if (!dates) return 'canceled';

  const Calendar = await loadExpoCalendar();
  if (!Calendar) {
    return openGoogleCalendarFallback(input);
  }

  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: input.title || 'Événement',
      startDate: dates.start,
      endDate: dates.end,
      location: input.locationLabel || undefined,
      notes: buildCalendarNotes(input),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
      url: getEventShareUrl(input.id),
    });
    if (result.action === Calendar.CalendarDialogResultActions.canceled) {
      return 'canceled';
    }
    if (result.action === Calendar.CalendarDialogResultActions.saved) {
      return 'saved';
    }
    return 'opened';
  } catch (error) {
    console.warn('native calendar composer', error);
    return openGoogleCalendarFallback(input);
  }
}
