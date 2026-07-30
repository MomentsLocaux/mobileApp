import { create } from 'zustand';
import {
  fingerprintSearch,
  SavedSearchesService,
  type SavedSearchSnapshot,
  type SavedSearchesState,
} from '@/services/saved-searches.service';
import { useSearchStore, type SearchState } from '@/store/searchStore';
import { buildSearchSummary } from '@/utils/search-summary';
import type { Category, Subcategory, Tag } from '@/store/taxonomyStore';

type TaxonomyLabels = {
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
};

type SavedSearchesStore = SavedSearchesState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordRecentFromCurrent: (taxonomy: TaxonomyLabels) => Promise<void>;
  saveCurrent: (taxonomy: TaxonomyLabels, title?: string) => Promise<SavedSearchSnapshot | null>;
  applySearch: (id: string) => boolean;
  removeSearch: (id: string) => Promise<void>;
  renameSearch: (id: string, title: string) => Promise<void>;
  isCurrentSaved: (taxonomy: TaxonomyLabels) => boolean;
};

const persist = async (state: SavedSearchesState) => {
  await SavedSearchesService.persist(state);
};

const currentFingerprint = () => {
  const s = useSearchStore.getState();
  return fingerprintSearch({
    where: s.where,
    when: s.when,
    what: s.what,
    sortBy: s.sortBy,
    sortOrder: s.sortOrder,
  });
};

const summaryForCurrent = (taxonomy: TaxonomyLabels) => {
  const s = useSearchStore.getState();
  return buildSearchSummary(s as SearchState, taxonomy.categories, taxonomy.subcategories, taxonomy.tags);
};

export const useSavedSearchesStore = create<SavedSearchesStore>((set, get) => ({
  recent: [],
  saved: [],
  hydrated: false,

  hydrate: async () => {
    const loaded = await SavedSearchesService.load();
    set({ ...loaded, hydrated: true });
  },

  recordRecentFromCurrent: async (taxonomy) => {
    const s = useSearchStore.getState();
    const snapshot = SavedSearchesService.buildSnapshot({
      kind: 'recent',
      title: summaryForCurrent(taxonomy),
      where: s.where,
      when: s.when,
      what: s.what,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
    });
    const next = SavedSearchesService.recordRecent(
      { recent: get().recent, saved: get().saved },
      snapshot,
    );
    set({ recent: next.recent, saved: next.saved });
    await persist(next);
  },

  saveCurrent: async (taxonomy, title) => {
    const s = useSearchStore.getState();
    const snapshot = SavedSearchesService.buildSnapshot({
      kind: 'saved',
      title: (title || summaryForCurrent(taxonomy)).trim(),
      where: s.where,
      when: s.when,
      what: s.what,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
    });
    const next = SavedSearchesService.saveNamed(
      { recent: get().recent, saved: get().saved },
      snapshot,
    );
    set({ recent: next.recent, saved: next.saved });
    await persist(next);
    return next.saved[0] || snapshot;
  },

  applySearch: (id) => {
    const item =
      get().saved.find((s) => s.id === id) || get().recent.find((s) => s.id === id);
    if (!item) return false;
    const store = useSearchStore.getState();
    store.resetSearch();
    store.setWhere({ ...item.where, history: [] });
    store.setWhen({ ...item.when });
    store.setWhat({ ...item.what });
    if (item.sortBy) store.setSortBy(item.sortBy);
    if (item.sortOrder) store.setSortOrder(item.sortOrder);
    store.commitSearch();
    return true;
  },

  removeSearch: async (id) => {
    const next = SavedSearchesService.remove(
      { recent: get().recent, saved: get().saved },
      id,
    );
    set({ recent: next.recent, saved: next.saved });
    await persist(next);
  },

  renameSearch: async (id, title) => {
    const next = SavedSearchesService.rename(
      { recent: get().recent, saved: get().saved },
      id,
      title,
    );
    set({ recent: next.recent, saved: next.saved });
    await persist(next);
  },

  isCurrentSaved: () => {
    const fp = currentFingerprint();
    return get().saved.some((item) => fingerprintSearch(item) === fp);
  },
}));
