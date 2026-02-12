import { useCallback, useEffect } from 'react';
import { useCreatorDashboardStore } from '@/store/creatorDashboard.store';

export function useCreatorDashboard(creatorId?: string | null) {
  const fetchCreatorDashboard = useCreatorDashboardStore((state) => state.fetchCreatorDashboard);

  const dashboard = useCreatorDashboardStore((state) =>
    creatorId ? state.dashboards[creatorId] : undefined,
  );

  const loading = useCreatorDashboardStore((state) =>
    creatorId ? !!state.loadingByCreator[creatorId] : false,
  );

  const error = useCreatorDashboardStore((state) =>
    creatorId ? state.errorByCreator[creatorId] ?? null : null,
  );

  useEffect(() => {
    if (!creatorId) return;
    fetchCreatorDashboard(creatorId).catch(() => undefined);
  }, [creatorId, fetchCreatorDashboard]);

  const refresh = useCallback(async () => {
    if (!creatorId) return;
    await fetchCreatorDashboard(creatorId, { force: true });
  }, [creatorId, fetchCreatorDashboard]);

  return {
    stats: dashboard?.stats ?? null,
    eventStats: dashboard?.eventStats ?? [],
    loading,
    error,
    refresh,
  };
}
