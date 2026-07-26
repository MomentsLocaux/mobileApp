import { supabase } from '@/lib/supabase/client';
import type { CategoryVisualSlug } from '@/constants/category-visuals';

export type NotifyFrequency = 'instant' | 'daily' | 'weekly';

/** HH:MM:SS or HH:MM from Postgres `time`, or null when quiet hours off. */
export type QuietTime = string | null;

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
  max_push_per_day: number;
  quiet_hours_start: QuietTime;
  quiet_hours_end: QuietTime;
  preferred_category_slugs: string[];
};

const PREF_FIELDS =
  'user_id, push_enabled, email_enabled, notify_event_nearby, notify_rewards, notify_social, notify_radius_km, notify_frequency, notify_followed_creator, notify_event_reminders, discovery_push_enabled, right_now_push_enabled, break_loop_push_enabled, life_insight_push_enabled, discovery_max_push_per_week, max_push_per_day, quiet_hours_start, quiet_hours_end, preferred_category_slugs';

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
  max_push_per_day: 3,
  quiet_hours_start: null,
  quiet_hours_end: null,
  preferred_category_slugs: [],
};

export const THEME_CHIP_LABELS: Record<CategoryVisualSlug, string> = {
  'arts-culture': 'Arts & culture',
  'marches-artisanat': 'Marchés',
  'fetes-animations': 'Fêtes',
  'famille-enfants': 'Famille',
  'gastronomie-saveurs': 'Gastronomie',
  'nature-bienetre': 'Nature',
  'ateliers-apprentissage': 'Ateliers',
  'sport-loisirs': 'Sport',
  'vie-locale': 'Vie locale',
  'insolite-ephemere': 'Insolite',
};

const normalizeQuietTime = (value: unknown): QuietTime => {
  if (value == null || value === '') return null;
  const raw = String(value);
  const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?/);
  if (!match) return null;
  return `${match[1]}:${match[2]}:00`;
};

const normalizePrefs = (row: Record<string, unknown>, userId: string): UserPreferences => ({
  user_id: userId,
  ...DEFAULT_PREFERENCES,
  ...(row as Partial<UserPreferences>),
  quiet_hours_start: normalizeQuietTime(row.quiet_hours_start),
  quiet_hours_end: normalizeQuietTime(row.quiet_hours_end),
  preferred_category_slugs: Array.isArray(row.preferred_category_slugs)
    ? (row.preferred_category_slugs as string[])
    : [],
  max_push_per_day:
    typeof row.max_push_per_day === 'number' ? row.max_push_per_day : DEFAULT_PREFERENCES.max_push_per_day,
});

export const PreferencesService = {
  async getMine(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(PREF_FIELDS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message || 'Impossible de charger les préférences');
    if (data) return normalizePrefs(data as Record<string, unknown>, userId);
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
