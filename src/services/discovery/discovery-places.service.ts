import { supabase } from '@/lib/supabase/client';
import type { DiscoveryDailySummary, DiscoveryPlace } from '@/types/discovery.types';

export const DiscoveryPlacesService = {
  async listPlaces(limit = 50): Promise<DiscoveryPlace[]> {
    const { data, error } = await supabase
      .from('discovery_places')
      .select('*')
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message || 'Impossible de charger les lieux');
    return (data ?? []) as DiscoveryPlace[];
  },

  async getRecentSummaries(days = 30): Promise<DiscoveryDailySummary[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('discovery_daily_summaries')
      .select('*')
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false });

    if (error) throw new Error(error.message || 'Impossible de charger les résumés');
    return (data ?? []) as DiscoveryDailySummary[];
  },
};
