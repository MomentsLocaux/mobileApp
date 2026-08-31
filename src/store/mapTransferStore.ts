import { create } from 'zustand';

/** One-shot Home → Map recadrage. Filters live in `discoveryFiltersStore`. */
export interface HomeMapTransfer {
  id: string;
  createdAt: number;
}

interface MapTransferState {
  homeTransfer: HomeMapTransfer | null;
  setHomeTransfer: () => HomeMapTransfer;
  clearHomeTransfer: () => void;
}

export const useMapTransferStore = create<MapTransferState>((set) => ({
  homeTransfer: null,
  setHomeTransfer: () => {
    const transfer: HomeMapTransfer = {
      id: `home-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    set({ homeTransfer: transfer });
    return transfer;
  },
  clearHomeTransfer: () => set({ homeTransfer: null }),
}));
