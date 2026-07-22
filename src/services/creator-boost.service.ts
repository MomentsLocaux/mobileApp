import { supabase } from '@/lib/supabase/client';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type EarnedBoostSummary = {
  unused: number;
  threshold: number;
  credits: Array<{
    id: string;
    source_event_id: string;
    status: string;
    used_on_event_id?: string | null;
    created_at: string;
  }>;
};

export const CreatorBoostService = {
  async getMine(): Promise<EarnedBoostSummary> {
    if (!GAMIFICATION_ENABLED) {
      return { unused: 0, threshold: 5, credits: [] };
    }
    const { data, error } = await supabase.rpc('get_my_earned_boosts');
    if (error) throw new Error(error.message || 'Impossible de charger les boosts gagnés');
    const row = (data || {}) as {
      unused?: number;
      threshold?: number;
      credits?: EarnedBoostSummary['credits'];
    };
    return {
      unused: Number(row.unused || 0),
      threshold: Number(row.threshold || 5),
      credits: Array.isArray(row.credits) ? row.credits : [],
    };
  },

  async applyToEvent(eventId: string): Promise<{ expires_at?: string }> {
    if (!GAMIFICATION_ENABLED) throw new Error('GAMIFICATION_DISABLED');
    const { data, error } = await supabase.rpc('use_earned_event_boost', {
      p_event_id: eventId,
    });
    if (error) throw new Error(error.message || 'Impossible d’utiliser le boost gagné');
    return (data || {}) as { expires_at?: string };
  },
};
