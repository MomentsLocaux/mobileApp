export type TimeFilter = 'today' | 'tonight' | 'tomorrow' | 'weekend' | 'live';
export type PopularityFilter = 'trending' | 'popular' | 'top';
export type EventDurationBucket = 'exceptional' | 'short' | 'long';
export type SortOption = 'triage' | 'distance' | 'popularity' | 'date' | 'endDate' | 'created';
export type SortOrder = 'asc' | 'desc';

export interface EventFilters {
  category?: string;
  categories?: string[];
  subcategory?: string;
  subcategories?: string[];
  name?: string;
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
  duration?: EventDurationBucket[];
}

export interface MapFilters extends EventFilters {
  sortBy?: SortOption;
  sortOrder?: SortOrder;
}
