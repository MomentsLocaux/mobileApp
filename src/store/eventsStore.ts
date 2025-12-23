import { create } from 'zustand';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';

type FetchOptions = {
  force?: boolean;
  limit?: number;
  staleMs?: number;
};

type EventsState = {
  events: EventWithCreator[];
  loading: boolean;
  error: string | null;
  lastFetched?: number;
  lastLimit?: number;
  fetchEvents: (options?: FetchOptions) => Promise<void>;
};

const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutes

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  lastFetched: undefined,
  lastLimit: undefined,
  fetchEvents: async (options: FetchOptions = {}) => {
    const { force = false, limit, staleMs = DEFAULT_STALE_MS } = options;
    const state = get();
    const now = Date.now();
    const effectiveLimit = typeof limit === 'number' ? limit : state.lastLimit ?? 200;
    const isFresh =
      !force &&
      state.events.length > 0 &&
      state.lastFetched &&
      now - state.lastFetched < staleMs &&
      (state.lastLimit ?? 0) >= effectiveLimit;

    if (isFresh || state.loading) {
      return;
    }

    set({ loading: true, error: null });
    try {
      const data = await EventsService.list(effectiveLimit);
      set({
        events: data || [],
        loading: false,
        error: null,
        lastFetched: Date.now(),
        lastLimit: effectiveLimit,
      });
    } catch (e: any) {
      console.error('[useEventsStore] fetchEvents error', e);
      set({
        loading: false,
        error: e?.message || 'Erreur chargement événements',
      });
    }
  },
}));
