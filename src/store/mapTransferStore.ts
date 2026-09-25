import { create } from 'zustand';

export type HomeMapFocus = {
  latitude: number;
  longitude: number;
  radiusKm: number;
};

/** One-shot Home → Map recadrage. Filters live in `discoveryFiltersStore`. */
export interface HomeMapTransfer {
  id: string;
  createdAt: number;
  openSearch?: boolean;
  focus?: HomeMapFocus;
}

interface MapTransferState {
  homeTransfer: HomeMapTransfer | null;
  setHomeTransfer: (options?: { openSearch?: boolean; focus?: HomeMapFocus }) => HomeMapTransfer;
  clearHomeTransfer: () => void;
}

export const useMapTransferStore = create<MapTransferState>((set) => ({
  homeTransfer: null,
  setHomeTransfer: (options) => {
    const transfer: HomeMapTransfer = {
      id: `home-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      openSearch: options?.openSearch,
      focus: options?.focus,
    };
    set({ homeTransfer: transfer });
    return transfer;
  },
  clearHomeTransfer: () => set({ homeTransfer: null }),
}));
