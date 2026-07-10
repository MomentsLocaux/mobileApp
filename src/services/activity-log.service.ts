import { supabase } from '@/lib/supabase/client';

export type ActivityLogAction =
  | 'view_recommendation'
  | 'dismiss_recommendation'
  | 'open_recommendation'
  | 'route_requested'
  | 'share_event'
  | 'premium_paywall_view'
  | 'premium_trial_started'
  | 'premium_subscribed';

export const ActivityLogService = {
  async log(action: ActivityLogAction, metadata?: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.rpc('log_activity', {
      p_action: action,
      p_metadata: metadata ?? {},
    });
    if (error) {
      // activity_log may be unavailable in some environments — non-blocking
      console.warn('[activity-log]', error.message);
    }
  },
};
