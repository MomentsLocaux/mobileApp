import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventCategory } from '../types/database';

export const getCategoryLabel = (category: EventCategory): string => {
  const { categoriesMap } = useTaxonomyStore.getState();
  if (!category) return 'Catégorie';
  return categoriesMap[category]?.label || String(category);
};

export const getCategoryIcon = (category: EventCategory): string => {
  const { categoriesMap } = useTaxonomyStore.getState();
  if (!category) return 'circle';
  return categoriesMap[category]?.icon || 'circle';
};
