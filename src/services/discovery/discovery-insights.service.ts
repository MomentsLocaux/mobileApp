import { supabase } from '@/lib/supabase/client';
import type { DiscoveryInsight } from '@/types/discovery.types';

export const DiscoveryInsightsService = {
  async getActive(limit = 5): Promise<DiscoveryInsight[]> {
    const { data, error } = await supabase.rpc('get_active_insights', { p_limit: limit });
    if (error) throw new Error(error.message || 'Impossible de charger les insights');
    return (data ?? []) as DiscoveryInsight[];
  },

  async markSeen(insightId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_discovery_insight_seen', {
      p_insight_id: insightId,
    });
    if (error) throw new Error(error.message || 'Impossible de marquer l’insight');
  },
};
