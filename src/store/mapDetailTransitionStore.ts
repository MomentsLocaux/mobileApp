import { create } from 'zustand';
import type { ScreenRect } from '@/utils/map-detail-transition';
import type { EventWithCreator } from '@/types/database';

export type MapDetailTransitionContext = {
  origin: 'map-unit' | 'map-sheet';
  eventId: string;
  event: EventWithCreator;
  targetCardRect: ScreenRect | null;
};

type MapDetailTransitionState = {
  context: MapDetailTransitionContext | null;
  returningEventId: string | null;
  prepare: (context: MapDetailTransitionContext) => void;
  markReturning: (eventId: string) => void;
  clear: () => void;
};

export const useMapDetailTransitionStore = create<MapDetailTransitionState>(
  (set) => ({
    context: null,
    returningEventId: null,
    prepare: (context) => set({ context, returningEventId: null }),
    markReturning: (eventId) => set({ returningEventId: eventId }),
    clear: () => set({ context: null, returningEventId: null }),
  }),
);
