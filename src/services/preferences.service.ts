import { supabase } from '@/lib/supabase/client';

export type NotifyFrequency = 'instant' | 'daily' | 'weekly';

export type UserPreferences = {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  notify_event_nearby: boolean;
  notify_rewards: boolean;
  notify_social: boolean;
  notify_radius_km: number;
  notify_frequency: NotifyFrequency;
  notify_followed_creator: boolean;
  notify_event_reminders: boolean;
  discovery_push_enabled: boolean;
  right_now_push_enabled: boolean;
  break_loop_push_enabled: boolean;
  life_insight_push_enabled: boolean;
  discovery_max_push_per_week: number;
};

const PREF_FIELDS =
  'user_id, push_enabled, email_enabled, notify_event_nearby, notify_rewards, notify_social, notify_radius_km, notify_frequency, notify_followed_creator, notify_event_reminders, discovery_push_enabled, right_now_push_enabled, break_loop_push_enabled, life_insight_push_enabled, discovery_max_push_per_week';

// Mirrors the column defaults so a user without a row still sees sane values.
export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id'> = {
  push_enabled: true,
  email_enabled: false,
  notify_event_nearby: true,
  notify_rewards: true,
  notify_social: true,
  notify_radius_km: 25,
  notify_frequency: 'instant',
  notify_followed_creator: true,
  notify_event_reminders: true,
  discovery_push_enabled: false,
  right_now_push_enabled: false,
  break_loop_push_enabled: false,
  life_insight_push_enabled: false,
  discovery_max_push_per_week: 3,
};

export const PreferencesService = {
  async getMine(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(PREF_FIELDS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message || 'Impossible de charger les préférences');
    if (data) return data as unknown as UserPreferences;
    return { user_id: userId, ...DEFAULT_PREFERENCES };
  },

  async updateMine(userId: string, patch: Partial<Omit<UserPreferences, 'user_id'>>): Promise<void> {
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(error.message || 'Impossible de mettre à jour les préférences');
  },
};
