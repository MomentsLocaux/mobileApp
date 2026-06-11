import { create } from 'zustand';
import type { EventWithCreator } from '@/types/database';

type SheetStatus = 'browsing' | 'loading' | 'viewportResults' | 'singleEvent';

interface FrozenViewportSnapshot {
  events: EventWithCreator[];
  eventCount: number;
}

interface MapResultsUIState {
  bottomSheetIndex: number;
  sheetStatus: SheetStatus;
  sheetEvents: EventWithCreator[];
  visibleEventCount: number;
  activeEventId?: string;
  frozenViewport: FrozenViewportSnapshot | null;
  viewportFetchError: string | null;

  setBottomSheetIndex: (index: number) => void;
  setStatus: (status: SheetStatus) => void;
  setViewportFetchError: (message: string | null) => void;
  displayViewportResults: (events: EventWithCreator[]) => void;
  highlightViewportEvent: (event: EventWithCreator) => void;
  selectSingleEvent: (event: EventWithCreator, snapIndex?: number) => void;
  freezeViewportResults: () => void;
  clearFrozenViewport: () => void;
  closeSheet: () => void;
  syncViewportEvents: (events: EventWithCreator[]) => void;
  restoreViewportFromFrozen: (options?: { keepHighlight?: boolean }) => boolean;
}

export const useMapResultsUIStore = create<MapResultsUIState>((set, get) => ({
  bottomSheetIndex: 0,
  sheetStatus: 'browsing',
  sheetEvents: [],
  visibleEventCount: 0,
  activeEventId: undefined,
  frozenViewport: null,
  viewportFetchError: null,

  setBottomSheetIndex: (index) => set({ bottomSheetIndex: index }),
  setStatus: (status) => set({ sheetStatus: status }),
  setViewportFetchError: (message) => set({ viewportFetchError: message }),
  displayViewportResults: (events) => {
    const { activeEventId } = get();
    const keepHighlight =
      !!activeEventId && events.some((event) => event.id === activeEventId);
    set({
      sheetStatus: 'viewportResults',
      sheetEvents: events,
      visibleEventCount: events.length,
      activeEventId: keepHighlight ? activeEventId : undefined,
    });
  },
  highlightViewportEvent: (event) => {
    set({
      sheetStatus: 'viewportResults',
      activeEventId: event.id,
    });
  },
  selectSingleEvent: (event, snapIndex = 1) => {
    set({
      sheetStatus: 'singleEvent',
      sheetEvents: [event],
      activeEventId: event.id,
      bottomSheetIndex: snapIndex,
    });
  },
  freezeViewportResults: () => {
    const { sheetEvents, visibleEventCount } = get();
    set({
      frozenViewport: {
        events: sheetEvents,
        eventCount: visibleEventCount,
      },
    });
  },
  clearFrozenViewport: () => set({ frozenViewport: null }),
  restoreViewportFromFrozen: (options) => {
    const { frozenViewport, activeEventId } = get();
    if (!frozenViewport) return false;
    set({
      sheetStatus: 'viewportResults',
      sheetEvents: frozenViewport.events,
      visibleEventCount: frozenViewport.eventCount,
      activeEventId: options?.keepHighlight ? activeEventId : undefined,
    });
    return true;
  },
  closeSheet: () => {
    const { sheetStatus } = get();
    if (sheetStatus === 'singleEvent') {
      get().restoreViewportFromFrozen();
      return;
    }
    set({ activeEventId: undefined });
  },
  syncViewportEvents: (events) =>
    set((state) => ({
      sheetEvents: events,
      visibleEventCount: events.length,
      frozenViewport: state.frozenViewport
        ? { events, eventCount: events.length }
        : state.frozenViewport,
    })),
}));
