import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { AnalyticsService } from '@/services/analytics.service';

const appVersion = () => Constants.expoConfig?.version ?? '0';

const platform = (): 'ios' | 'android' | 'web' =>
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

/** Records app opens and session length. One session per foreground visit. */
export function useProductAnalytics() {
  const active = useRef(false);

  useEffect(() => {
    const open = () => {
      if (active.current) return;
      active.current = true;
      AnalyticsService.startSession();
      AnalyticsService.track('app_opened', { platform: platform(), version: appVersion() });
    };

    const close = () => {
      if (!active.current) return;
      active.current = false;
      AnalyticsService.track('session_end', {
        duration_seconds: AnalyticsService.sessionDurationSeconds(),
      });
    };

    open();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') open();
      if (next === 'background') close();
    });
    return () => {
      close();
      subscription.remove();
    };
  }, []);
}
