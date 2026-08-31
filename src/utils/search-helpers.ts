import { DISCOVERY_DEFAULT_RADIUS_KM } from '@/constants/filters';
import type {
  DiscoveryContentFilter,
  DiscoveryPlaceFilter,
  DiscoveryWhenFilter,
} from '@/utils/discovery-filters';

/** Home / search list fetches (non-map). */
export const SEARCH_FETCH_LIMIT = 300;

/**
 * Map viewport marker cap sent to `list_map_viewport`.
 * Zoom no longer reduces this: the bbox diameter (`MAX_MAP_BBOX_DIAMETER_KM`) is the
 * safety rail. The RPC still clamps with `LEAST(p_limit, 1500)`.
 * The sheet list is capped separately in the fetch hook.
 */
export const MAP_VIEWPORT_LIMIT_MAX = 1500;
export const MAP_SHEET_LIST_LIMIT = 120;

export const DEFAULT_SEARCH_RADIUS_KM = DISCOVERY_DEFAULT_RADIUS_KM;
export const PROXIMITY_RADIUS_KM = 40;

type Coords = { latitude: number; longitude: number };

/** How many events to pull for the visible map bbox (RPC still caps at 1500). */
export const resolveMapViewportLimit = (_zoom?: number | null): number => MAP_VIEWPORT_LIMIT_MAX;

export type DiscoverySearchCriteria = {
  place: DiscoveryPlaceFilter;
  when: DiscoveryWhenFilter;
  content: DiscoveryContentFilter;
};

export const hasSearchCriteria = (search: DiscoverySearchCriteria): boolean => {
  const includePast = search.when.includePast ?? false;
  const hasWhere =
    Boolean(search.place.center) ||
    Boolean(search.place.label?.trim()) ||
    (search.place.radiusKm !== undefined &&
      search.place.radiusKm !== DISCOVERY_DEFAULT_RADIUS_KM);
  const hasWhen =
    !!search.when.preset ||
    !!search.when.startDate ||
    !!search.when.endDate ||
    includePast;
  const hasWhat =
    search.content.categories.length > 0 ||
    search.content.subcategories.length > 0 ||
    !!search.content.query?.trim();
  return hasWhere || hasWhen || hasWhat;
};

/** Radius used for bbox + client filter — 0 in UI becomes default 10 km when a center exists. */
export const resolveEffectiveRadiusKm = (
  place: DiscoveryPlaceFilter,
  userCoords?: Coords | null
): number | undefined => {
  const center = resolveSearchCenter(place, userCoords);
  if (!center) return undefined;
  if (place.radiusKm !== undefined) {
    return place.radiusKm > 0 ? place.radiusKm : DEFAULT_SEARCH_RADIUS_KM;
  }
  return DEFAULT_SEARCH_RADIUS_KM;
};

export const resolveSearchCenter = (
  place: DiscoveryPlaceFilter,
  userCoords?: Coords | null
): Coords | null => {
  if (place.center) {
    return { latitude: place.center.latitude, longitude: place.center.longitude };
  }
  if (
    place.radiusKm !== undefined &&
    userCoords
  ) {
    return userCoords;
  }
  return null;
};

export const getBoundsFromRadiusKm = (latitude: number, longitude: number, radiusKm: number) => {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));
  return {
    ne: [longitude + lonDelta, latitude + latDelta] as [number, number],
    sw: [longitude - lonDelta, latitude - latDelta] as [number, number],
  };
};
