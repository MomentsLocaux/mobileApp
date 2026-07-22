import { supabase } from '@/lib/supabase/client';
import { GAMIFICATION_ENABLED } from '@/config/gamification.flags';

export type MissionProgressItem = {
  mission_id: string;
  title: string;
  description: string | null;
  kind: string;
  target: number;
  reward_lumo: number;
  steps: string[];
  progress: number;
  completed: boolean;
  completed_at: string | null;
  period_key: string | null;
  steps_done: string[];
};

export const MissionsService = {
  async listMine(): Promise<{ gamificationEnabled: boolean; missions: MissionProgressItem[] }> {
    if (!GAMIFICATION_ENABLED) {
      return { gamificationEnabled: false, missions: [] };
    }
    const { data, error } = await supabase.rpc('get_my_missions');
    if (error) throw new Error(error.message || 'Impossible de charger les missions');
    const row = (data || {}) as {
      gamification_enabled?: boolean;
      missions?: MissionProgressItem[];
    };
    return {
      gamificationEnabled: row.gamification_enabled === true,
      missions: Array.isArray(row.missions) ? row.missions : [],
    };
  },

  async recordStep(step: string): Promise<void> {
    if (!GAMIFICATION_ENABLED || !step) return;
    try {
      await supabase.rpc('record_mission_progress', { p_step: step });
    } catch (err) {
      console.warn('record_mission_progress', err);
    }
  },
};
