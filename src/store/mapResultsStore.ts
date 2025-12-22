import { create } from 'zustand';
import type { EventWithCreator } from '../types/database';

export type BottomSheetMode = 'idle' | 'single' | 'cluster' | 'viewport';

interface MapResultsState {
  bottomSheetIndex: number;
  bottomSheetMode: BottomSheetMode;
  bottomSheetEvents: EventWithCreator[];
  viewportEvents: EventWithCreator[];
  viewportCount: number;
  setBottomSheetIndex: (index: number) => void;
  setBottomSheetMode: (mode: BottomSheetMode) => void;
  setBottomSheetEvents: (events: EventWithCreator[]) => void;
  setViewportEvents: (events: EventWithCreator[]) => void;
}

export const useMapResultsStore = create<MapResultsState>((set) => ({
  bottomSheetIndex: 1,
  bottomSheetMode: 'idle',
  bottomSheetEvents: [],
  viewportEvents: [],
  viewportCount: 0,
  setBottomSheetIndex: (index) => set({ bottomSheetIndex: index }),
  setBottomSheetMode: (mode) => set({ bottomSheetMode: mode }),
  setBottomSheetEvents: (events) => set({ bottomSheetEvents: events }),
  setViewportEvents: (events) => set({ viewportEvents: events, viewportCount: events.length }),
}));
