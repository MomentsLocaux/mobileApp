import type { EventCategory } from './database';

export type TimeFilter = 'weekend' | 'live';
export type PopularityFilter = 'trending' | 'popular' | 'top';
export type SortOption = 'distance' | 'popularity' | 'date';

export interface EventFilters {
  category?: EventCategory;
  time?: TimeFilter;
  freeOnly?: boolean;
  paidOnly?: boolean;
  visibility?: 'public' | 'prive';
  includePast?: boolean;
  popularity?: PopularityFilter;
  tag?: string;
}

export interface MapFilters extends EventFilters {
  sortBy?: SortOption;
}
