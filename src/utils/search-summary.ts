import { DEFAULT_SORT_OPTION } from '@/constants/filters';
import type { Category, Subcategory, Tag } from '@/store/taxonomyStore';
import {
  summarize,
  type DiscoveryFilters,
  type DiscoverySurface,
} from '@/utils/discovery-filters';

export const buildSearchSummary = (
  filters: DiscoveryFilters,
  categories: Category[],
  subcategories: Subcategory[],
  tags: Tag[],
  surface?: DiscoverySurface
) => {
  const labels: Record<string, string> = {};
  categories.forEach((category) => {
    labels[category.id] = category.label;
  });
  subcategories.forEach((subcategory) => {
    labels[subcategory.id] = subcategory.label;
  });
  tags.forEach((tag) => {
    labels[tag.slug] = tag.label;
  });

  return summarize(
    {
      ...filters,
      status: 'all',
      sort: surface
        ? filters.sort
        : {
            home: { sortBy: DEFAULT_SORT_OPTION },
            map: { sortBy: DEFAULT_SORT_OPTION },
          },
    },
    { surface, categoryLabels: labels, emptyLabel: 'Recherche' }
  );
};
