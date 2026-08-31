import {
  DEFAULT_DISCOVERY_STATUS,
  DEFAULT_DISCOVERY_WHEN_PRESET,
  DEFAULT_SORT_OPTION,
  HOME_DEFAULT_SORT_OPTION,
} from '@/constants/filters';
import type { Category, Subcategory } from '@/store/taxonomyStore';
import {
  summarize,
  type DiscoveryFilters,
  type DiscoverySurface,
} from '@/utils/discovery-filters';

export const buildSearchSummary = (
  filters: DiscoveryFilters,
  categories: Category[],
  subcategories: Subcategory[],
  surface?: DiscoverySurface
) => {
  const labels: Record<string, string> = {};
  categories.forEach((category) => {
    labels[category.id] = category.label;
  });
  subcategories.forEach((subcategory) => {
    labels[subcategory.id] = subcategory.label;
  });
  const hasExplicitWhen = Boolean(
    filters.when.preset ||
      filters.when.startDate ||
      filters.when.endDate ||
      filters.when.includePast
  );
  return summarize(
    {
      ...filters,
      status: DEFAULT_DISCOVERY_STATUS,
      when: hasExplicitWhen
        ? filters.when
        : { preset: DEFAULT_DISCOVERY_WHEN_PRESET, includePast: false },
      sort: surface
        ? filters.sort
        : {
            home: { sortBy: HOME_DEFAULT_SORT_OPTION, sortOrder: 'asc' },
            map: { sortBy: DEFAULT_SORT_OPTION },
          },
    },
    { surface, categoryLabels: labels, emptyLabel: 'Recherche' }
  );
};
