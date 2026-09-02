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
  return summarize(filters, { surface, categoryLabels: labels, emptyLabel: 'Recherche' });
};
