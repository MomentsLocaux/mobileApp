/**
 * Home/Map discovery contract helpers.
 * Keep browse vs search vs handoff rules in one place so map.tsx cannot drift.
 */

import { DISCOVERY_DEFAULT_RADIUS_KM } from '../constants/filters';
import type { EventFilters } from '../types/filters';
import type { DiscoveryPlaceFilter } from './discovery-filters';

export function isDiscoverySearchActive(
  searchApplied: boolean,
  hasSearchCriteria: boolean
): boolean {
  return searchApplied && hasSearchCriteria;
}

export function resolveMapHandoffMode(options: {
  searchApplied: boolean;
  hasSearchCriteria: boolean;
}): 'browse' | 'search' {
  return isDiscoverySearchActive(options.searchApplied, options.hasSearchCriteria)
    ? 'search'
    : 'browse';
}

type MapCoords = { latitude: number; longitude: number };

function searchCenter(
  place: DiscoveryPlaceFilter,
  userLocation: MapCoords | null
): MapCoords | null {
  if (place.center) {
    return { latitude: place.center.latitude, longitude: place.center.longitude };
  }
  if (place.radiusKm !== undefined && userLocation) {
    return userLocation;
  }
  return null;
}

function effectiveRadiusKm(
  place: DiscoveryPlaceFilter,
  userLocation: MapCoords | null
): number | undefined {
  if (!searchCenter(place, userLocation)) return undefined;
  if (place.radiusKm !== undefined) {
    return place.radiusKm > 0 ? place.radiusKm : DISCOVERY_DEFAULT_RADIUS_KM;
  }
  return DISCOVERY_DEFAULT_RADIUS_KM;
}

/** Camera target for Home → Map: same circle Home used, then Map refetches that viewport. */
export function resolveHomeMapRadiusTarget(options: {
  searchActive: boolean;
  place: DiscoveryPlaceFilter;
  userLocation: MapCoords | null;
}): (MapCoords & { radiusKm: number }) | null {
  const { searchActive, place, userLocation } = options;

  if (searchActive) {
    const center = searchCenter(place, userLocation) ?? userLocation;
    const radiusKm =
      effectiveRadiusKm(place, userLocation) ??
      (center
        ? place.radiusKm && place.radiusKm > 0
          ? place.radiusKm
          : DISCOVERY_DEFAULT_RADIUS_KM
        : undefined);
    if (!center || radiusKm === undefined) return null;
    return { latitude: center.latitude, longitude: center.longitude, radiusKm };
  }

  const center = place.center ?? userLocation;
  if (!center) return null;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    radiusKm: place.radiusKm ?? DISCOVERY_DEFAULT_RADIUS_KM,
  };
}

export function shouldRefetchViewportOnTabFocus(options: {
  bootstrapped: boolean;
  hasNewTransfer: boolean;
  hasNewSearchRevision: boolean;
}): boolean {
  if (options.hasNewTransfer || options.hasNewSearchRevision) return true;
  return !options.bootstrapped;
}

/** Recadrage when Home published a new ping or a new applied search while Map was away. */
export function shouldApplyPendingHomeRecadrage(options: {
  mapReady: boolean;
  transferId: string | null | undefined;
  appliedTransferId: string | null;
  searchActive: boolean;
  searchRevision: number;
  focusedSearchRevision: number | null;
}): boolean {
  if (!options.mapReady) return false;
  if (options.transferId && options.transferId !== options.appliedTransferId) return true;
  if (options.searchActive && options.focusedSearchRevision !== options.searchRevision) {
    return true;
  }
  return false;
}

export function shouldPublishViewportToMap(options: {
  frozen: boolean;
  sheetStatus: string;
  ignoreFreeze?: boolean;
}): boolean {
  if (options.ignoreFreeze) return true;
  if (options.sheetStatus === 'singleEvent') return false;
  if (options.frozen) return false;
  return true;
}

/** Date presets / ranges apply in browse refine and in search; query stays search-only. */
export function shouldApplyWhenFilters(
  searchActive: boolean,
  filters?: Pick<EventFilters, 'time' | 'startDate' | 'endDate'>
): boolean {
  if (searchActive) return true;
  return Boolean(filters?.time || filters?.startDate || filters?.endDate);
}

export function resolveMapClientFilters(
  filters: EventFilters,
  searchActive: boolean
): EventFilters {
  const content: EventFilters = {
    category: filters.category,
    categories: filters.categories,
    subcategory: filters.subcategory,
    subcategories: filters.subcategories,
    includePast: true,
  };
  if (!shouldApplyWhenFilters(searchActive, filters)) {
    return content;
  }
  return {
    ...content,
    includePast: filters.includePast,
    time: filters.time,
    startDate: filters.startDate,
    endDate: filters.endDate,
    name: searchActive ? filters.name : undefined,
  };
}

/** Chip "search this area" keeps what/when filters; only the geographic lock is released. */
export function shouldResetCriteriaOnAreaSearch(): boolean {
  return false;
}

/** Programmatic camera moves refresh the viewport only when callers opt in. */
export function resolvePendingProgrammaticRefresh(refreshAfter?: boolean): boolean {
  return refreshAfter === true;
}
