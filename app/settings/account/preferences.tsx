import { Redirect } from 'expo-router';

/** PREF-P0-002 — comfort prefs live in the notification preference center. */
export default function AccountPreferencesScreen() {
  return <Redirect href="/settings/notifications" />;
}
