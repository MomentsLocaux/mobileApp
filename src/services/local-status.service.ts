import { supabase } from '@/lib/supabase/client';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type LocalStatusTier = 'local' | 'habitue' | 'ambassadeur';

export type LocalStatus = {
  gamificationEnabled: boolean;
  userId: string;
  city?: string | null;
  periodKey?: string | null;
  checkinsCount?: number;
  eventsHeldCount?: number;
  contributionsCount?: number;
  score?: number;
  tier: LocalStatusTier;
  isAmbassadeur: boolean;
  computedAt?: string | null;
};

const emptyStatus = (userId: string): LocalStatus => ({
  gamificationEnabled: false,
  userId,
  tier: 'local',
  isAmbassadeur: false,
});

export const LocalStatusService = {
  async getForUser(userId: string): Promise<LocalStatus> {
    if (!userId) return emptyStatus('');
    if (!GAMIFICATION_ENABLED) return emptyStatus(userId);

    const { data, error } = await supabase.rpc('get_local_status', { p_user_id: userId });
    if (error) {
      console.warn('get_local_status', error);
      return emptyStatus(userId);
    }

    const row = (data || {}) as Record<string, unknown>;
    const tierRaw = String(row.tier || 'local');
    const tier: LocalStatusTier =
      tierRaw === 'ambassadeur' || tierRaw === 'habitue' ? tierRaw : 'local';

    return {
      gamificationEnabled: row.gamification_enabled === true,
      userId: String(row.user_id || userId),
      city: (row.city as string | null) ?? null,
      periodKey: (row.period_key as string | null) ?? null,
      checkinsCount: Number(row.checkins_count || 0),
      eventsHeldCount: Number(row.events_held_count || 0),
      contributionsCount: Number(row.contributions_count || 0),
      score: Number(row.score || 0),
      tier,
      isAmbassadeur: row.is_ambassadeur === true,
      computedAt: (row.computed_at as string | null) ?? null,
    };
  },
};
