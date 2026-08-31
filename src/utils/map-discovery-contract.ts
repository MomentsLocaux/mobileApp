/**
 * Home/Map discovery contract helpers.
 * Keep browse vs search vs handoff rules in one place so map.tsx cannot drift.
 */

import { DISCOVERY_DEFAULT_RADIUS_KM } from '../constants/filters';
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

export function shouldApplyBrowseWhatWhenFilters(searchActive: boolean): boolean {
  return searchActive;
}

/** Chip "search this area" keeps what/when filters; only the geographic lock is released. */
export function shouldResetCriteriaOnAreaSearch(): boolean {
  return false;
}

/** Programmatic camera moves refresh the viewport only when callers opt in. */
export function resolvePendingProgrammaticRefresh(refreshAfter?: boolean): boolean {
  return refreshAfter === true;
}
