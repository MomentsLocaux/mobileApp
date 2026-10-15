import { supabase } from '@/lib/supabase/client';
import {
  CATEGORY_VISUAL_LABELS,
  type CategoryVisualSlug,
} from '@/constants/category-visuals';
import {
  parsePushPersonalization,
  preferencePatchFromPushPolicy,
  type PushPersonalizationAnswers,
} from '@/utils/push-personalization';

export type NotifyFrequency = 'instant' | 'daily' | 'weekly';

/** Social visibility of home_location (SCRUM-74). Nearby alerts stay separate. */
export type LocationVisibility = 'nobody' | 'followers' | 'public';

/** HH:MM:SS or HH:MM from Postgres `time`, or null when quiet hours off. */
export type QuietTime = string | null;

export type UserPreferences = {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  notify_event_nearby: boolean;
  /** PUSH-P0-003: approach alerts near live/soon events (background location). */
  notify_proximity_live: boolean;
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
  location_visibility: LocationVisibility;
  /** Questionnaire snapshot. Null until the onboarding policy step is answered. */
  push_personalization: PushPersonalizationAnswers | null;
};

const PREF_FIELDS =
  'user_id, push_enabled, email_enabled, notify_event_nearby, notify_proximity_live, notify_rewards, notify_social, notify_radius_km, notify_frequency, notify_followed_creator, notify_event_reminders, discovery_push_enabled, right_now_push_enabled, break_loop_push_enabled, life_insight_push_enabled, discovery_max_push_per_week, max_push_per_day, quiet_hours_start, quiet_hours_end, preferred_category_slugs, location_visibility, push_personalization';

// Mirrors the column defaults so a user without a row still sees sane values.
export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id'> = {
  push_enabled: true,
  email_enabled: false,
  notify_event_nearby: true,
  notify_proximity_live: false,
  notify_rewards: false,
  notify_social: true,
  notify_radius_km: 25,
  notify_frequency: 'instant',
  notify_followed_creator: false,
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
  location_visibility: 'nobody',
  push_personalization: null,
};

export const THEME_CHIP_LABELS: Record<CategoryVisualSlug, string> = CATEGORY_VISUAL_LABELS;

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
  location_visibility:
    row.location_visibility === 'followers' || row.location_visibility === 'public'
      ? row.location_visibility
      : 'nobody',
  max_push_per_day:
    typeof row.max_push_per_day === 'number' ? row.max_push_per_day : DEFAULT_PREFERENCES.max_push_per_day,
  push_personalization: parsePushPersonalization(row.push_personalization),
});

export const PreferencesService = {
  async getMine(userId: string): Promise<UserPreferences> {
    const load = (fields: string) =>
      supabase.from('user_preferences').select(fields).eq('user_id', userId).maybeSingle();

    let fields = PREF_FIELDS;
    let result = await load(fields);
    for (let attempt = 0; attempt < 2 && result.error; attempt += 1) {
      const message = result.error.message || '';
      const next = /push_personalization/i.test(message)
        ? fields.replace(', push_personalization', '')
        : /location_visibility/i.test(message)
          ? fields.replace(', location_visibility', '')
          : null;
      if (!next || next === fields) break;
      fields = next;
      result = await load(fields);
    }
    if (result.error) throw new Error(result.error.message || 'Impossible de charger les préférences');
    if (result.data) return normalizePrefs(result.data as unknown as Record<string, unknown>, userId);
    return { user_id: userId, ...DEFAULT_PREFERENCES };
  },

  async updateMine(userId: string, patch: Partial<Omit<UserPreferences, 'user_id'>>): Promise<void> {
    const write = (body: Partial<Omit<UserPreferences, 'user_id'>>) =>
      supabase.from('user_preferences').upsert(
        {
          user_id: userId,
          ...body,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id' },
      );

    let body = patch;
    let { error } = await write(body);
    if (error && /push_personalization/i.test(error.message || '') && 'push_personalization' in body) {
      const rest = { ...body };
      delete rest.push_personalization;
      body = rest;
      ({ error } = await write(body));
    }
    if (error) throw new Error(error.message || 'Impossible de mettre à jour les préférences');
  },

  /**
   * Saves the onboarding questionnaire and copies it onto the live notify_* toggles.
   * A missing snapshot column still leaves those toggles in place.
   */
  async savePushPersonalization(userId: string, answers: PushPersonalizationAnswers): Promise<void> {
    await PreferencesService.updateMine(userId, preferencePatchFromPushPolicy(answers));
  },
};
