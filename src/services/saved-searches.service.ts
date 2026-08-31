import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SearchWhatState,
  SearchWhenState,
  SearchWhereState,
} from '@/store/searchStore';
import type { SortOption, SortOrder } from '@/types/filters';
import type { DiscoveryStatus } from '@/constants/filters';

const STORAGE_KEY = 'ml.saved_searches.v1';
const MAX_RECENT = 8;
const MAX_SAVED = 10;

export type SavedSearchKind = 'recent' | 'saved';

export type SavedSearchSnapshot = {
  id: string;
  kind: SavedSearchKind;
  title: string;
  createdAt: string;
  where: Omit<SearchWhereState, 'history'>;
  when: SearchWhenState;
  what: SearchWhatState;
  sortBy?: SortOption;
  sortOrder?: SortOrder;
  status?: DiscoveryStatus;
};

export type SavedSearchesState = {
  recent: SavedSearchSnapshot[];
  saved: SavedSearchSnapshot[];
};

const emptyState = (): SavedSearchesState => ({ recent: [], saved: [] });

const newId = () =>
  `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function fingerprintSearch(input: {
  where: Omit<SearchWhereState, 'history'>;
  when: SearchWhenState;
  what: SearchWhatState;
  sortBy?: SortOption;
  sortOrder?: SortOrder;
  status?: DiscoveryStatus;
}): string {
  return JSON.stringify({
    label: input.where.location?.label || null,
    city: input.where.location?.city || null,
    lat: input.where.location?.latitude ?? null,
    lon: input.where.location?.longitude ?? null,
    radiusKm: input.where.radiusKm ?? null,
    preset: input.when.preset ?? null,
    startDate: input.when.startDate ?? null,
    endDate: input.when.endDate ?? null,
    includePast: Boolean(input.when.includePast),
    categories: [...(input.what.categories || [])].sort(),
    subcategories: [...(input.what.subcategories || [])].sort(),
    tags: [...(input.what.tags || [])].sort(),
    query: (input.what.query || '').trim().toLowerCase(),
    sortBy: input.sortBy ?? null,
    sortOrder: input.sortOrder ?? null,
    status: input.status ?? null,
  });
}

const stripWhere = (where: SearchWhereState): Omit<SearchWhereState, 'history'> => {
  const { history: _history, ...rest } = where;
  return rest;
};

const normalizeLoaded = (raw: unknown): SavedSearchesState => {
  if (!raw || typeof raw !== 'object') return emptyState();
  const data = raw as Partial<SavedSearchesState>;
  const recent = Array.isArray(data.recent) ? data.recent.filter(isSnapshot) : [];
  const saved = Array.isArray(data.saved) ? data.saved.filter(isSnapshot) : [];
  return { recent: recent.slice(0, MAX_RECENT), saved: saved.slice(0, MAX_SAVED) };
};

const isSnapshot = (value: unknown): value is SavedSearchSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const s = value as SavedSearchSnapshot;
  return (
    typeof s.id === 'string' &&
    (s.kind === 'recent' || s.kind === 'saved') &&
    typeof s.title === 'string' &&
    typeof s.createdAt === 'string' &&
    !!s.where &&
    !!s.when &&
    !!s.what
  );
};

export const SavedSearchesService = {
  async load(): Promise<SavedSearchesState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      return normalizeLoaded(JSON.parse(raw));
    } catch (error) {
      console.warn('saved searches load failed', error);
      return emptyState();
    }
  },

  async persist(state: SavedSearchesState): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          recent: state.recent.slice(0, MAX_RECENT),
          saved: state.saved.slice(0, MAX_SAVED),
        }),
      );
    } catch (error) {
      console.warn('saved searches persist failed', error);
    }
  },

  buildSnapshot(input: {
    kind: SavedSearchKind;
    title: string;
    where: SearchWhereState;
    when: SearchWhenState;
    what: SearchWhatState;
    sortBy?: SortOption;
    sortOrder?: SortOrder;
    status?: DiscoveryStatus;
    id?: string;
  }): SavedSearchSnapshot {
    return {
      id: input.id || newId(),
      kind: input.kind,
      title: input.title.trim() || 'Recherche',
      createdAt: new Date().toISOString(),
      where: stripWhere(input.where),
      when: { ...input.when },
      what: {
        categories: [...(input.what.categories || [])],
        subcategories: [...(input.what.subcategories || [])],
        tags: [...(input.what.tags || [])],
        query: input.what.query || '',
      },
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      status: input.status,
    };
  },

  recordRecent(
    state: SavedSearchesState,
    snapshot: SavedSearchSnapshot,
  ): SavedSearchesState {
    const fp = fingerprintSearch(snapshot);
    const withoutDup = state.recent.filter((item) => fingerprintSearch(item) !== fp);
    return {
      ...state,
      recent: [{ ...snapshot, kind: 'recent' as const }, ...withoutDup].slice(0, MAX_RECENT),
    };
  },

  saveNamed(
    state: SavedSearchesState,
    snapshot: SavedSearchSnapshot,
  ): SavedSearchesState {
    const fp = fingerprintSearch(snapshot);
    const withoutDup = state.saved.filter((item) => fingerprintSearch(item) !== fp);
    return {
      ...state,
      saved: [{ ...snapshot, kind: 'saved' as const }, ...withoutDup].slice(0, MAX_SAVED),
    };
  },

  rename(
    state: SavedSearchesState,
    id: string,
    title: string,
  ): SavedSearchesState {
    const nextTitle = title.trim();
    if (!nextTitle) return state;
    return {
      recent: state.recent.map((item) =>
        item.id === id ? { ...item, title: nextTitle } : item,
      ),
      saved: state.saved.map((item) =>
        item.id === id ? { ...item, title: nextTitle } : item,
      ),
    };
  },

  remove(state: SavedSearchesState, id: string): SavedSearchesState {
    return {
      recent: state.recent.filter((item) => item.id !== id),
      saved: state.saved.filter((item) => item.id !== id),
    };
  },

  findByFingerprint(
    state: SavedSearchesState,
    fp: string,
  ): SavedSearchSnapshot | undefined {
    return (
      state.saved.find((item) => fingerprintSearch(item) === fp) ||
      state.recent.find((item) => fingerprintSearch(item) === fp)
    );
  },
};
