import { create } from 'zustand';
import type { EventWithCreator } from '@/types/database';

export type MapSheetMode = 'viewport' | 'singleEvent';

interface MapResultsUIState {
  bottomSheetIndex: number;
  sheetMode: MapSheetMode;
  sheetEvents: EventWithCreator[];
  viewportEvents: EventWithCreator[];
  visibleEventCount: number;
  activeEventId?: string;
  isViewportFetching: boolean;

  setBottomSheetIndex: (index: number) => void;
  setViewportFetching: (fetching: boolean) => void;
  setViewportResults: (events: EventWithCreator[]) => void;
  setViewportPeekCount: (count: number) => void;
  enterSingleEvent: (event: EventWithCreator, snapIndex?: number) => void;
  exitSingleEvent: () => void;
  resetMapSheet: () => void;
}

export const useMapResultsUIStore = create<MapResultsUIState>((set, get) => ({
  bottomSheetIndex: 0,
  sheetMode: 'viewport',
  sheetEvents: [],
  viewportEvents: [],
  visibleEventCount: 0,
  activeEventId: undefined,
  isViewportFetching: false,

  setBottomSheetIndex: (index) => set({ bottomSheetIndex: index }),

  setViewportFetching: (fetching) => set({ isViewportFetching: fetching }),

  setViewportResults: (events) => {
    set({
      sheetMode: 'viewport',
      sheetEvents: events,
      viewportEvents: events,
      visibleEventCount: events.length,
      activeEventId: undefined,
      isViewportFetching: false,
    });
  },

  setViewportPeekCount: (count) => {
    set({
      visibleEventCount: count,
      isViewportFetching: false,
    });
  },

  resetMapSheet: () => {
    set({
      bottomSheetIndex: 0,
      sheetMode: 'viewport',
      sheetEvents: [],
      viewportEvents: [],
      visibleEventCount: 0,
      activeEventId: undefined,
      isViewportFetching: false,
    });
  },

  enterSingleEvent: (event, snapIndex = 1) => {
    const { sheetMode, viewportEvents, sheetEvents } = get();
    const preservedViewport =
      sheetMode === 'viewport' && sheetEvents.length > 0 ? sheetEvents : viewportEvents;

    set({
      sheetMode: 'singleEvent',
      viewportEvents: preservedViewport,
      sheetEvents: [event],
      activeEventId: event.id,
      bottomSheetIndex: snapIndex,
    });
  },

  exitSingleEvent: () => {
    const { sheetMode, viewportEvents } = get();
    if (sheetMode !== 'singleEvent') return;

    set({
      sheetMode: 'viewport',
      sheetEvents: viewportEvents,
      visibleEventCount: viewportEvents.length,
      activeEventId: undefined,
      bottomSheetIndex: 0,
    });
  },
}));
