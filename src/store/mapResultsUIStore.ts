import { create } from 'zustand';
import type { EventWithCreator } from '@/types/database';

type PaddingLevel = 'low' | 'medium' | 'high';
type SheetStatus = 'browsing' | 'loading' | 'viewportResults' | 'singleEvent';

interface MapResultsUIState {
  // Maintained state
  bottomSheetIndex: number;
  bottomBarVisible: boolean;
  mapPaddingLevel: PaddingLevel;

  // New state machine
  sheetStatus: SheetStatus;
  sheetEvents: EventWithCreator[];
  visibleEventCount: number;
  activeEventId?: string;

  // Actions
  setBottomSheetIndex: (index: number) => void;
  showBottomBar: () => void;
  hideBottomBar: () => void;
  updateMapPadding: (level: PaddingLevel) => void;

  // New state machine actions
  setStatus: (status: SheetStatus) => void;
  displayViewportResults: (events: EventWithCreator[]) => void;
  selectSingleEvent: (event: EventWithCreator, snapIndex?: number) => void;
  closeSheet: () => void;
}

export const useMapResultsUIStore = create<MapResultsUIState>((set, get) => ({
  // Maintained state
  bottomSheetIndex: 0,
  bottomBarVisible: false,
  mapPaddingLevel: 'low',

  // New state machine
  sheetStatus: 'browsing',
  sheetEvents: [],
  visibleEventCount: 0,
  activeEventId: undefined,

  // Actions
  setBottomSheetIndex: (index) => set({ bottomSheetIndex: index }),
  showBottomBar: () => set({ bottomBarVisible: true }),
  hideBottomBar: () => set({ bottomBarVisible: false }),
  updateMapPadding: (level) => set({ mapPaddingLevel: level }),

  // New state machine actions
  setStatus: (status) => set({ sheetStatus: status }),
  displayViewportResults: (events) => {
    set({
      sheetStatus: 'viewportResults',
      sheetEvents: events,
      visibleEventCount: events.length,
      activeEventId: undefined,
    });
  },
  selectSingleEvent: (event, snapIndex = 1) => {
    set({
      sheetStatus: 'singleEvent',
      sheetEvents: [event],
      activeEventId: event.id,
      bottomSheetIndex: snapIndex,
      mapPaddingLevel: snapIndex === 2 ? 'high' : 'medium',
      bottomBarVisible: true,
    });
  },
  closeSheet: () => {
    const { sheetStatus } = get();
    // Only reset if we are not already browsing.
    // This prevents wiping the event list if the user just peeks.
    if (sheetStatus === 'singleEvent') {
      set({
        sheetStatus: 'viewportResults', // Go back to viewport, don't clear results
        activeEventId: undefined,
      });
    }
  },
}));
