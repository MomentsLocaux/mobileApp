import type { SearchState } from '@/store/searchStore';

/** Home / search list fetches (non-map). */
export const SEARCH_FETCH_LIMIT = 300;

/**
 * Map viewport marker caps — adaptive to zoom.
 * Mapbox clusters pins; sheet list is capped separately in the fetch hook.
 */
export const MAP_VIEWPORT_LIMIT_MAX = 1500;
export const MAP_SHEET_LIST_LIMIT = 120;

export const DEFAULT_SEARCH_RADIUS_KM = 10;
export const PROXIMITY_RADIUS_KM = 40;

type Coords = { latitude: number; longitude: number };

/**
 * How many events to pull for the visible map bbox.
 * Zoomed-in → denser fetch; country zoom → lower cap (clustering covers density).
 */
export const resolveMapViewportLimit = (zoom?: number | null): number => {
  const z = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 12;
  if (z >= 13) return MAP_VIEWPORT_LIMIT_MAX; // neighborhood / city streets
  if (z >= 11) return 1000; // agglomeration
  if (z >= 9) return 700; // region
  return 500; // country / wide
};

export const hasSearchCriteria = (search: Pick<SearchState, 'where' | 'when' | 'what'>): boolean => {
  const includePast = search.when.includePast ?? false;
  const hasWhere = !!search.where.location || search.where.radiusKm !== undefined;
  const hasWhen =
    !!search.when.preset ||
    !!search.when.startDate ||
    !!search.when.endDate ||
    includePast;
  const hasWhat =
    search.what.categories.length > 0 ||
    search.what.subcategories.length > 0 ||
    search.what.tags.length > 0 ||
    !!search.what.query?.trim();
  return hasWhere || hasWhen || hasWhat;
};

/** Radius used for bbox + client filter — 0 in UI becomes default 10 km when a center exists. */
export const resolveEffectiveRadiusKm = (
  where: SearchState['where'],
  userCoords?: Coords | null
): number | undefined => {
  const center = resolveSearchCenter(where, userCoords);
  if (!center) return undefined;
  if (where.radiusKm !== undefined) {
    return where.radiusKm > 0 ? where.radiusKm : DEFAULT_SEARCH_RADIUS_KM;
  }
  return DEFAULT_SEARCH_RADIUS_KM;
};

export const resolveSearchCenter = (
  where: SearchState['where'],
  userCoords?: Coords | null
): Coords | null => {
  if (where.location) {
    return { latitude: where.location.latitude, longitude: where.location.longitude };
  }
  if (where.radiusKm !== undefined && userCoords) {
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
