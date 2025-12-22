import { create } from 'zustand';

type PaddingLevel = 'low' | 'medium' | 'high';

interface MapResultsUIState {
  bottomSheetIndex: number;
  bottomBarVisible: boolean;
  mapPaddingLevel: PaddingLevel;
  setBottomSheetIndex: (index: number) => void;
  showBottomBar: () => void;
  hideBottomBar: () => void;
  updateMapPadding: (level: PaddingLevel) => void;
}

export const useMapResultsUIStore = create<MapResultsUIState>((set) => ({
  bottomSheetIndex: 1,
  bottomBarVisible: true,
  mapPaddingLevel: 'medium',
  setBottomSheetIndex: (index) => set({ bottomSheetIndex: index }),
  showBottomBar: () => set({ bottomBarVisible: true }),
  hideBottomBar: () => set({ bottomBarVisible: false }),
  updateMapPadding: (level) => set({ mapPaddingLevel: level }),
}));
