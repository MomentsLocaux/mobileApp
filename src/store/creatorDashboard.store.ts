import { create } from 'zustand';
import { getCreatorDashboard, getEventStats } from '@/services/creatorStats.service';
import type { CreatorDashboardData } from '@/types/creator.types';

type FetchOptions = {
  force?: boolean;
  staleMs?: number;
};

type CreatorDashboardState = {
  dashboards: Record<string, CreatorDashboardData>;
  loadingByCreator: Record<string, boolean>;
  errorByCreator: Record<string, string | null>;
  fetchCreatorDashboard: (creatorId: string, options?: FetchOptions) => Promise<void>;
  clearCreatorDashboard: (creatorId: string) => void;
};

const DEFAULT_STALE_MS = 60 * 1000;

export const useCreatorDashboardStore = create<CreatorDashboardState>((set, get) => ({
  dashboards: {},
  loadingByCreator: {},
  errorByCreator: {},

  fetchCreatorDashboard: async (creatorId: string, options: FetchOptions = {}) => {
    const { force = false, staleMs = DEFAULT_STALE_MS } = options;
    const state = get();
    const entry = state.dashboards[creatorId];
    const now = Date.now();

    if (!force && entry && now - entry.fetchedAt < staleMs) {
      return;
    }

    if (state.loadingByCreator[creatorId]) {
      return;
    }

    set((prev) => ({
      loadingByCreator: { ...prev.loadingByCreator, [creatorId]: true },
      errorByCreator: { ...prev.errorByCreator, [creatorId]: null },
    }));

    try {
      const [stats, eventStats] = await Promise.all([
        getCreatorDashboard(creatorId),
        getEventStats(creatorId),
      ]);

      set((prev) => ({
        dashboards: {
          ...prev.dashboards,
          [creatorId]: {
            stats,
            eventStats,
            fetchedAt: Date.now(),
          },
        },
        loadingByCreator: { ...prev.loadingByCreator, [creatorId]: false },
        errorByCreator: { ...prev.errorByCreator, [creatorId]: null },
      }));
    } catch (error: any) {
      set((prev) => ({
        loadingByCreator: { ...prev.loadingByCreator, [creatorId]: false },
        errorByCreator: {
          ...prev.errorByCreator,
          [creatorId]: error?.message || 'Impossible de charger les statistiques créateur',
        },
      }));
    }
  },

  clearCreatorDashboard: (creatorId: string) => {
    set((prev) => {
      const dashboards = { ...prev.dashboards };
      const loadingByCreator = { ...prev.loadingByCreator };
      const errorByCreator = { ...prev.errorByCreator };
      delete dashboards[creatorId];
      delete loadingByCreator[creatorId];
      delete errorByCreator[creatorId];
      return { dashboards, loadingByCreator, errorByCreator };
    });
  },
}));
