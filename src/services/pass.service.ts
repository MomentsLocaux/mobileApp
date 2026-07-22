import { supabase } from '@/lib/supabase/client';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type PassStatus = {
  enabled: boolean;
  redemptionLive: boolean;
  periodKey?: string;
  checkinsCount: number;
  stampsRequired: number;
  streakUnlocked: boolean;
  message: string;
  pass?: {
    id: string;
    status: string;
    redemption_code?: string | null;
    created_at?: string;
  } | null;
};

export const PassService = {
  async getMine(): Promise<PassStatus> {
    if (!GAMIFICATION_ENABLED) {
      return {
        enabled: false,
        redemptionLive: false,
        checkinsCount: 0,
        stampsRequired: 3,
        streakUnlocked: false,
        message: 'Pass partenaire bientôt disponible.',
      };
    }
    const { data, error } = await supabase.rpc('get_my_pass_status');
    if (error) throw new Error(error.message || 'Impossible de charger le Pass');
    const row = (data || {}) as Record<string, unknown>;
    return {
      enabled: row.enabled === true,
      redemptionLive: row.redemption_live === true,
      periodKey: (row.period_key as string) || undefined,
      checkinsCount: Number(row.checkins_count || 0),
      stampsRequired: Number(row.stamps_required || 3),
      streakUnlocked: row.streak_unlocked === true,
      message: String(row.message || ''),
      pass: (row.pass as PassStatus['pass']) || null,
    };
  },
};
