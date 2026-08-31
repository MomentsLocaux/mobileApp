import { create } from 'zustand';
import type { EventWithCreator } from '@/types/database';
import type { MapBounds } from '@/types/map-events';
import type { DiscoveryFilters } from '@/utils/discovery-filters';

export interface HomeMapTransfer {
  id: string;
  createdAt: number;
  filters: DiscoveryFilters;
  events: EventWithCreator[];
  bounds: MapBounds | null;
}

interface MapTransferState {
  homeTransfer: HomeMapTransfer | null;
  setHomeTransfer: (input: Omit<HomeMapTransfer, 'id' | 'createdAt'>) => HomeMapTransfer;
  clearHomeTransfer: () => void;
}

const cloneFilters = (filters: DiscoveryFilters): DiscoveryFilters => ({
  ...filters,
  when: { ...filters.when },
  place: {
    ...filters.place,
    center: filters.place.center ? { ...filters.place.center } : filters.place.center,
  },
  content: {
    ...filters.content,
    categories: [...filters.content.categories],
    subcategories: [...filters.content.subcategories],
    tags: [],
  },
  sort: {
    home: { ...filters.sort.home },
    map: { ...filters.sort.map },
  },
});

export const useMapTransferStore = create<MapTransferState>((set) => ({
  homeTransfer: null,
  setHomeTransfer: (input) => {
    const transfer: HomeMapTransfer = {
      id: `home-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      filters: cloneFilters(input.filters),
      events: [...input.events],
      bounds: input.bounds
        ? { ne: [...input.bounds.ne], sw: [...input.bounds.sw] }
        : null,
    };
    set({ homeTransfer: transfer });
    return transfer;
  },
  clearHomeTransfer: () => set({ homeTransfer: null }),
}));
