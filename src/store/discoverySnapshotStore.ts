import { create } from 'zustand';
import type { MapBounds } from '@/types/map-events';

export const HOME_SNAPSHOT_EVENT_LIMIT = 80;
export const MAP_SNAPSHOT_MARKER_LIMIT = 200;
export const MAP_SNAPSHOT_SHEET_LIMIT = 80;
export const MAP_SNAPSHOT_STALE_MS = 24 * 60 * 60 * 1000;

export type HomeDiscoverySnapshot = {
  queryKey: string;
  center: { latitude: number; longitude: number } | null;
  radiusKm: number;
  eventIds: string[];
  storedAt: number;
};

export type MapDiscoverySnapshot = {
  camera: { latitude: number; longitude: number; zoom: number } | null;
  bounds: MapBounds | null;
  markerEventIds: string[];
  sheetEventIds: string[];
  storedAt: number;
};

type DiscoverySnapshotState = {
  home: HomeDiscoverySnapshot | null;
  map: MapDiscoverySnapshot | null;
  hydrated: boolean;
  setHomeSnapshot: (snapshot: HomeDiscoverySnapshot) => void;
  setMapSnapshot: (snapshot: MapDiscoverySnapshot) => void;
  markHydrated: () => void;
  hydrate: (payload: { home?: HomeDiscoverySnapshot | null; map?: MapDiscoverySnapshot | null }) => void;
};

const capIds = (ids: string[], limit: number): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
    if (next.length >= limit) break;
  }
  return next;
};

export function isMapSnapshotStale(
  snapshot: MapDiscoverySnapshot | null,
  now = Date.now(),
): boolean {
  if (!snapshot) return false;
  return now - snapshot.storedAt > MAP_SNAPSHOT_STALE_MS;
}

export const useDiscoverySnapshotStore = create<DiscoverySnapshotState>((set) => ({
  home: null,
  map: null,
  hydrated: false,
  setHomeSnapshot: (snapshot) =>
    set({
      home: {
        ...snapshot,
        eventIds: capIds(snapshot.eventIds, HOME_SNAPSHOT_EVENT_LIMIT),
      },
    }),
  setMapSnapshot: (snapshot) =>
    set({
      map: {
        ...snapshot,
        markerEventIds: capIds(snapshot.markerEventIds, MAP_SNAPSHOT_MARKER_LIMIT),
        sheetEventIds: capIds(snapshot.sheetEventIds, MAP_SNAPSHOT_SHEET_LIMIT),
      },
    }),
  markHydrated: () => set({ hydrated: true }),
  hydrate: (payload) =>
    set((state) => ({
      home: payload.home !== undefined ? payload.home : state.home,
      map: payload.map !== undefined ? payload.map : state.map,
      hydrated: true,
    })),
}));
