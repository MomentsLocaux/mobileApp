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
import type { Category, Subcategory } from '@/store/taxonomyStore';
import type { DiscoveryFilters, DiscoverySurface } from '@/utils/discovery-filters';
import { DEFAULT_SORT_OPTION } from '@/constants/filters';

type TaxonomyLabels = {
  categories: Category[];
  subcategories: Subcategory[];
};

type SavedSearchesStore = SavedSearchesState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordRecentFromCurrent: (
    taxonomy: TaxonomyLabels,
    surface: DiscoverySurface,
    filters?: DiscoveryFilters
  ) => Promise<void>;
  saveCurrent: (
    taxonomy: TaxonomyLabels,
    surface: DiscoverySurface,
    title?: string,
    filters?: DiscoveryFilters
  ) => Promise<SavedSearchSnapshot | null>;
  applySearch: (id: string, surface: DiscoverySurface) => DiscoveryFilters | null;
  removeSearch: (id: string) => Promise<void>;
  renameSearch: (id: string, title: string) => Promise<void>;
  isCurrentSaved: (
    taxonomy: TaxonomyLabels,
    surface: DiscoverySurface,
    filters?: DiscoveryFilters
  ) => boolean;
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
      tags: [],
      query: filters.content.query || '',
    },
    sortBy: filters.sort[surface].sortBy,
    sortOrder: filters.sort[surface].sortOrder,
  };
};

const currentFingerprint = (surface: DiscoverySurface, filters?: DiscoveryFilters) => {
  const s = toLegacySearchState(filters ?? currentDiscoveryFilters(), surface);
  return fingerprintSearch({
    where: s.where,
    when: s.when,
    what: s.what,
    sortBy: s.sortBy,
    sortOrder: s.sortOrder,
    status: (filters ?? currentDiscoveryFilters()).status,
  });
};

const summaryForCurrent = (
  taxonomy: TaxonomyLabels,
  surface: DiscoverySurface,
  filters?: DiscoveryFilters
) =>
  buildSearchSummary(
    filters ?? currentDiscoveryFilters(),
    taxonomy.categories,
    taxonomy.subcategories,
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

  recordRecentFromCurrent: async (taxonomy, surface, filters) => {
    const activeFilters = filters ?? currentDiscoveryFilters();
    const s = toLegacySearchState(activeFilters, surface);
    const snapshot = SavedSearchesService.buildSnapshot({
      kind: 'recent',
      title: summaryForCurrent(taxonomy, surface, activeFilters),
      where: s.where,
      when: s.when,
      what: s.what,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
      status: activeFilters.status,
    });
    const next = SavedSearchesService.recordRecent(
      { recent: get().recent, saved: get().saved },
      snapshot,
    );
    set({ recent: next.recent, saved: next.saved });
    await persist(next);
  },

  saveCurrent: async (taxonomy, surface, title, filters) => {
    const activeFilters = filters ?? currentDiscoveryFilters();
    const s = toLegacySearchState(activeFilters, surface);
    const snapshot = SavedSearchesService.buildSnapshot({
      kind: 'saved',
      title: (title || summaryForCurrent(taxonomy, surface, activeFilters)).trim(),
      where: s.where,
      when: s.when,
      what: s.what,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
      status: activeFilters.status,
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
    if (!item) return null;
    const store = useDiscoveryFiltersStore.getState();
    // New snapshots include the temporal status. Older persisted snapshots
    // remain valid and fall back to the current status axis.
    const current = currentDiscoveryFilters();
    const hasDatedSearch = Boolean(
      item.when.preset || item.when.startDate || item.when.endDate || item.when.includePast
    );
    return store.applySearchCriteria(
      {
        place: {
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
        },
        when: { ...item.when },
        // Legacy snapshots may contain tags that are no longer exposed in the UI.
        content: { ...item.what, tags: [] },
      },
      {
        status:
          item.status ?? (hasDatedSearch && current.status === 'past' ? 'all' : current.status),
        surface,
        sort: {
          sortBy: item.sortBy || DEFAULT_SORT_OPTION,
          sortOrder: item.sortOrder,
        },
        applied: true,
      }
    );
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

  isCurrentSaved: (_taxonomy, surface, filters) => {
    const fp = currentFingerprint(surface, filters);
    return get().saved.some((item) => fingerprintSearch(item) === fp);
  },
}));
