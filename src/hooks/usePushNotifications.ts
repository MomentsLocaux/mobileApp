import { useEffect, useRef } from 'react';
import {
  configureNotificationHandler,
  registerForPushNotificationsAsync,
  routeFromNotificationData,
  subscribeToNotificationResponses,
  syncHomeLocation,
  unregisterCurrentDevice,
} from '@/services/push.service';

/**
 * Wires Expo push notifications to the authenticated session:
 *  - configures foreground presentation
 *  - registers / refreshes the device token on login, removes it on logout
 *  - silently refreshes home_location when location permission is already granted
 *  - routes notification taps (foreground + cold start) to the right screen
 */
export function usePushNotifications(userId?: string | null) {
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    const prev = prevUserId.current;
    prevUserId.current = userId ?? null;

    if (userId) {
      registerForPushNotificationsAsync(userId);
      // Refresh the nearby reference point without prompting; the explicit
      // opt-in dialog lives in the notification preferences screen (Lot 5).
      syncHomeLocation({ prompt: false });
    } else if (prev) {
      unregisterCurrentDevice();
    }
  }, [userId]);

  useEffect(() => {
    return subscribeToNotificationResponses(routeFromNotificationData);
  }, []);
}
