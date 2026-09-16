import { persistStorage } from './persistStorage';
import { partializeEventCache, type EventCacheSnapshot } from './eventCache';
import { useDiscoverySnapshotStore } from './discoverySnapshotStore';
import { useEventPreviewStore } from './eventPreviewStore';

const EVENT_CACHE_STORAGE_KEY = 'event-cache-store';
const DISCOVERY_SNAPSHOT_STORAGE_KEY = 'discovery-snapshots';
const PERSIST_DEBOUNCE_MS = 750;

type PersistedSnapshots = {
  home: ReturnType<typeof useDiscoverySnapshotStore.getState>['home'];
  map: ReturnType<typeof useDiscoverySnapshotStore.getState>['map'];
};

let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistBound = false;

const parseJson = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

async function readAndHydrate(): Promise<void> {
  try {
    const [cacheRaw, snapshotRaw] = await Promise.all([
      persistStorage.getItem(EVENT_CACHE_STORAGE_KEY),
      persistStorage.getItem(DISCOVERY_SNAPSHOT_STORAGE_KEY),
    ]);

    const cacheParsed = parseJson(cacheRaw) as Partial<EventCacheSnapshot> | null;
    if (cacheParsed?.byId) {
      useEventPreviewStore.setState({
        byId: cacheParsed.byId,
        order: Array.isArray(cacheParsed.order) ? cacheParsed.order : Object.keys(cacheParsed.byId),
        pinnedBySurface: cacheParsed.pinnedBySurface ?? {},
        openedId: cacheParsed.openedId ?? null,
        epoch: (useEventPreviewStore.getState().epoch || 0) + 1,
      });
    }

    const snapshots = parseJson(snapshotRaw) as PersistedSnapshots | null;
    if (snapshots && (snapshots.home || snapshots.map)) {
      useDiscoverySnapshotStore.getState().hydrate({
        home: snapshots.home ?? null,
        map: snapshots.map ?? null,
      });
    }
  } finally {
    useDiscoverySnapshotStore.getState().markHydrated();
  }
}

async function flushDiscoveryPersist(): Promise<void> {
  const cache = partializeEventCache(useEventPreviewStore.getState());
  const snapshots = useDiscoverySnapshotStore.getState();
  await Promise.all([
    persistStorage.setItem(EVENT_CACHE_STORAGE_KEY, JSON.stringify(cache)),
    persistStorage.setItem(
      DISCOVERY_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({ home: snapshots.home, map: snapshots.map }),
    ),
  ]);
}

const schedulePersist = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushDiscoveryPersist().catch(() => undefined);
  }, PERSIST_DEBOUNCE_MS);
};

export function hydrateDiscoveryCaches(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = readAndHydrate().catch((error) => {
      console.warn('[discovery-cache] hydrate failed', error);
    });
  }
  if (!persistBound) {
    persistBound = true;
    useEventPreviewStore.subscribe(schedulePersist);
    useDiscoverySnapshotStore.subscribe(schedulePersist);
  }
  return hydratePromise;
}
