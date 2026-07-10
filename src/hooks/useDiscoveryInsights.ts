import { useCallback, useEffect, useState } from 'react';
import { DiscoveryInsightsService } from '@/services/discovery/discovery-insights.service';
import type { DiscoveryInsight } from '@/types/discovery.types';
import { useAuthStore } from '@/state/auth';

export function useDiscoveryInsights() {
  const userId = useAuthStore((state) => state.user?.id);
  const [insights, setInsights] = useState<DiscoveryInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setInsights([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await DiscoveryInsightsService.getActive();
      setInsights(rows);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markSeen = useCallback(async (insightId: string) => {
    await DiscoveryInsightsService.markSeen(insightId);
    setInsights((current) => current.filter((row) => row.id !== insightId));
  }, []);

  return { insights, loading, refresh, markSeen };
}
