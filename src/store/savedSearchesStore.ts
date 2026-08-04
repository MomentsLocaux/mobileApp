import { create } from 'zustand';
import {
  fingerprintSearch,
  SavedSearchesService,
  type SavedSearchSnapshot,
  type SavedSearchesState,
} from '@/services/saved-searches.service';
import type { SearchState } from '@/store/searchStore';
import {
  selectDiscoveryFilters,
  useDiscoveryFiltersStore,
} from '@/store/discoveryFiltersStore';
import { buildSearchSummary } from '@/utils/search-summary';
import type { Category, Subcategory, Tag } from '@/store/taxonomyStore';
import type { DiscoveryFilters, DiscoverySurface } from '@/utils/discovery-filters';
import { DEFAULT_SORT_OPTION } from '@/constants/filters';

type TaxonomyLabels = {
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
};

type SavedSearchesStore = SavedSearchesState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordRecentFromCurrent: (taxonomy: TaxonomyLabels, surface: DiscoverySurface) => Promise<void>;
  saveCurrent: (
    taxonomy: TaxonomyLabels,
    surface: DiscoverySurface,
    title?: string
  ) => Promise<SavedSearchSnapshot | null>;
  applySearch: (id: string, surface: DiscoverySurface) => boolean;
  removeSearch: (id: string) => Promise<void>;
  renameSearch: (id: string, title: string) => Promise<void>;
  isCurrentSaved: (taxonomy: TaxonomyLabels, surface: DiscoverySurface) => boolean;
};

const persist = async (state: SavedSearchesState) => {
  await SavedSearchesService.persist(state);
};

const currentDiscoveryFilters = (): DiscoveryFilters =>
  selectDiscoveryFilters(useDiscoveryFiltersStore.getState());

const toLegacySearchState = (
  filters: DiscoveryFilters,
  surface: DiscoverySurface
): Pick<SearchState, 'where' | 'when' | 'what' | 'sortBy' | 'sortOrder'> => {
  const center = filters.place.center;
  return {
    where: {
      history: [],
      location: center
        ? {
            latitude: center.latitude,
            longitude: center.longitude,
            label: filters.place.label || 'Zone choisie',
            city: filters.place.city,
            postalCode: filters.place.postalCode,
          }
        : undefined,
      radiusKm: filters.place.radiusKm,
    },
    when: { ...filters.when },
    what: {
      categories: [...filters.content.categories],
      subcategories: [...filters.content.subcategories],
      tags: [...filters.content.tags],
      query: filters.content.query || '',
    },
    sortBy: filters.sort[surface].sortBy,
    sortOrder: filters.sort[surface].sortOrder,
  };
};

const currentFingerprint = (surface: DiscoverySurface) => {
  const s = toLegacySearchState(currentDiscoveryFilters(), surface);
  return fingerprintSearch({
    where: s.where,
    when: s.when,
    what: s.what,
    sortBy: s.sortBy,
    sortOrder: s.sortOrder,
  });
};

const summaryForCurrent = (taxonomy: TaxonomyLabels, surface: DiscoverySurface) =>
  buildSearchSummary(
    currentDiscoveryFilters(),
    taxonomy.categories,
    taxonomy.subcategories,
    taxonomy.tags,
    surface
  );

export const useSavedSearchesStore = create<SavedSearchesStore>((set, get) => ({
  recent: [],
  saved: [],
  hydrated: false,

  hydrate: async () => {
    const loaded = await SavedSearchesService.load();
    set({ ...loaded, hydrated: true });
  },

  recordRecentFromCurrent: async (taxonomy, surface) => {
    const s = toLegacySearchState(currentDiscoveryFilters(), surface);
    const snapshot = SavedSearchesService.buildSnapshot({
      kind: 'recent',
      title: summaryForCurrent(taxonomy, surface),
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

  saveCurrent: async (taxonomy, surface, title) => {
    const s = toLegacySearchState(currentDiscoveryFilters(), surface);
    const snapshot = SavedSearchesService.buildSnapshot({
      kind: 'saved',
      title: (title || summaryForCurrent(taxonomy, surface)).trim(),
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

  applySearch: (id, surface) => {
    const item =
      get().saved.find((s) => s.id === id) || get().recent.find((s) => s.id === id);
    if (!item) return false;
    const store = useDiscoveryFiltersStore.getState();
    // A saved search contains place/date/content criteria, not the independent
    // status axis or presentation preferences.
    store.clearSearchCriteria();
    if (item.where.location || item.where.radiusKm !== undefined) {
      store.setPlace({
        center: item.where.location
          ? {
              latitude: item.where.location.latitude,
              longitude: item.where.location.longitude,
            }
          : null,
        label: item.where.location?.label,
        city: item.where.location?.city,
        postalCode: item.where.location?.postalCode,
        radiusKm: item.where.radiusKm,
      });
    }
    store.setWhen({ ...item.when });
    store.setContent({ ...item.what });
    store.setSort(
      surface,
      item.sortBy || DEFAULT_SORT_OPTION,
      item.sortOrder
    );
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

  isCurrentSaved: (_taxonomy, surface) => {
    const fp = currentFingerprint(surface);
    return get().saved.some((item) => fingerprintSearch(item) === fp);
  },
}));
