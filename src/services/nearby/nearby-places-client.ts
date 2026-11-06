/**
 * EVENT-NEARBY-001 — Mapbox Search Box category search for « À côté ».
 *
 * Uses the public Mapbox token already shipped for geocoding (`pk.` only).
 * A secret `sk.` token is ignored. The URL is never logged. Results are not stored.
 * Guests use the same public event sheet; this call does not require a session.
 */

import {
  MAPBOX_NEARBY_CATEGORIES,
  NEARBY_RADIUS_METERS,
  buildPlaceImageUrl,
  buildPlaceViewUrl,
  distanceMeters,
  nearbySearchRadiusDegrees,
  parseMapboxCategoryCollection,
  type NearbyFetchResult,
  type NearbyLoaderQuery,
  type NearbyRawPlace,
} from './nearby-places';

export const NEARBY_CLIENT_FLAG = 'EXPO_PUBLIC_FEATURE_NEARBY_PLACES';
const CATEGORY_ENDPOINT = 'https://api.mapbox.com/search/searchbox/v1/category';

export function selectMapboxPublicToken(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const token = value?.trim() ?? '';
    if (!token.startsWith('pk.')) continue;
    return token;
  }
  return null;
}

export function currentMapboxPublicToken(): string | null {
  return selectMapboxPublicToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
}

export function nearbyProviderIsAvailable(): boolean {
  return currentMapboxPublicToken() != null;
}

export async function requestNearbyPlaces(
  query: NearbyLoaderQuery,
  signal: AbortSignal,
): Promise<NearbyFetchResult> {
  const token = currentMapboxPublicToken();
  if (!token) return { status: 'blocked' };
  return fetchNearbyFromMapbox(query, signal, { token, fetchImpl: fetch });
}

export async function fetchNearbyFromMapbox(
  query: NearbyLoaderQuery,
  signal: AbortSignal,
  options: { token: string; fetchImpl?: typeof fetch },
): Promise<NearbyFetchResult> {
  const token = selectMapboxPublicToken(options.token);
  if (!token) return { status: 'blocked' };
  const fetchImpl = options.fetchImpl ?? fetch;
  const radius = nearbySearchRadiusDegrees(query.latitude, query.radiusMeters || NEARBY_RADIUS_METERS);
  const responses = await Promise.all(MAPBOX_NEARBY_CATEGORIES.map(async (category) => {
    const url = new URL(`${CATEGORY_ENDPOINT}/${category}`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('language', 'fr');
    url.searchParams.set('limit', '10');
    url.searchParams.set('proximity', `${query.longitude},${query.latitude}`);
    url.searchParams.set('radius', radius.toFixed(5));
    url.searchParams.set('exclude_fields', 'photos,reviews');
    const response = await fetchImpl(url, { signal });
    if (response.status === 400 || response.status === 404) {
      return { places: [] as NearbyRawPlace[], attribution: null };
    }
    if (!response.ok) throw new Error('unavailable');
    return parseMapboxCategoryCollection(await response.json(), category);
  }));

  const attribution = responses.map((item) => item.attribution).find((item) => item) ?? '';
  const seen = new Set<string>();
  const places: NearbyRawPlace[] = [];
  for (const response of responses) {
    for (const place of response.places) {
      const id = typeof place.id === 'string' ? place.id : '';
      if (!id || seen.has(id)) continue;
      const latitude = typeof place.latitude === 'number' ? place.latitude : null;
      const longitude = typeof place.longitude === 'number' ? place.longitude : null;
      if (latitude == null || longitude == null) continue;
      if (distanceMeters(
        { latitude: query.latitude, longitude: query.longitude },
        { latitude, longitude },
      ) > NEARBY_RADIUS_METERS) continue;
      seen.add(id);
      const name = typeof place.name === 'string' ? place.name : null;
      const address = typeof place.address === 'string' ? place.address : null;
      const locality = typeof place.locality === 'string' ? place.locality : null;
      places.push({
        ...place,
        googleMapsUri: buildPlaceViewUrl({ name, address, locality }),
        imageUrl: buildPlaceImageUrl(latitude, longitude, token),
      });
    }
  }
  if (places.length === 0) return { status: 'ok', places: [], attribution };
  if (!attribution) throw new Error('unavailable');
  return { status: 'ok', places, attribution };
}
