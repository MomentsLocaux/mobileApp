export type TimeFilter = 'today' | 'tomorrow' | 'weekend' | 'live';
export type PopularityFilter = 'trending' | 'popular' | 'top';
export type SortOption = 'distance' | 'popularity' | 'date';

export interface EventFilters {
  category?: string;
  categories?: string[];
  subcategory?: string;
  subcategories?: string[];
  time?: TimeFilter;
  startDate?: string;
  endDate?: string;
  radiusKm?: number;
  centerLat?: number;
  centerLon?: number;
  freeOnly?: boolean;
  paidOnly?: boolean;
  visibility?: 'public' | 'prive';
  includePast?: boolean;
  popularity?: PopularityFilter;
  tag?: string;
  tags?: string[];
}

export interface MapFilters extends EventFilters {
  sortBy?: SortOption;
}
