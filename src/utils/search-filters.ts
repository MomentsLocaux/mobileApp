import type { EventFilters } from '../types/filters';
import type { SearchState } from '../store/searchStore';

type Coords = { latitude: number; longitude: number };

export const buildFiltersFromSearch = (
  search: SearchState,
  userCoords?: Coords | null
): EventFilters => {
  const filters: EventFilters = {
    includePast: false,
  };

  const location = search.where.location || (search.where.radiusKm && userCoords
    ? {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        label: 'Autour de moi',
      }
    : undefined);

  if (location) {
    filters.centerLat = location.latitude;
    filters.centerLon = location.longitude;
    if (search.where.radiusKm) {
      filters.radiusKm = search.where.radiusKm;
    }
  }

  if (search.when.preset) {
    if (search.when.preset === 'weekend') {
      filters.time = 'weekend';
    } else if (search.when.preset === 'today') {
      filters.time = 'today';
    } else if (search.when.preset === 'tomorrow') {
      filters.time = 'tomorrow';
    }
  }

  if (search.when.startDate) {
    filters.startDate = search.when.startDate;
  }
  if (search.when.endDate) {
    filters.endDate = search.when.endDate;
  }

  if (search.what.categories.length > 0) {
    filters.categories = search.what.categories;
  }

  if (search.what.subcategories && search.what.subcategories.length > 0) {
    filters.subcategories = search.what.subcategories;
  }

  if (search.what.tags.length > 0) {
    filters.tags = search.what.tags;
  }

  return filters;
};
