/**
 * EVENT-NEARBY-001 — nearby cafés, bars and restaurants for an event sheet.
 *
 * The provider is Mapbox Search Box category search. Results stay temporary:
 * nothing is written to storage. Google Places is not called.
 */

export const NEARBY_RADIUS_METERS = 1000;
export const NEARBY_RESULT_LIMIT = 5;
export const NEARBY_TIMEOUT_MS = 8000;
export const NEARBY_VIEWPORT_PREFETCH_PX = 320;
export const NEARBY_INCLUDED_TYPES = ['cafe', 'bar', 'restaurant'] as const;
export const MAPBOX_NEARBY_CATEGORIES = ['coffee', 'restaurant', 'bar'] as const;
export const GOOGLE_MAPS_ATTRIBUTION = 'Google Maps';

/** Minimal Nearby Search (New) mask if a future compliant call is approved. Pro SKU. */
export const NEARBY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.location',
  'places.googleMapsUri',
  'places.attributions',
] as const;

const ENTERPRISE_FIELD_MARKERS = [
  'rating',
  'userRatingCount',
  'reviews',
  'currentOpeningHours',
  'regularOpeningHours',
  'priceLevel',
  'websiteUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'photos',
  'reservable',
  'editorialSummary',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Café',
  coffee: 'Café',
  coffee_shop: 'Café',
  bar: 'Bar',
  restaurant: 'Restaurant',
};

const ALLOWED_TYPES = new Set(Object.keys(CATEGORY_LABELS));

const EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NearbyRawPlace = {
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  types?: unknown;
  primaryType?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  location?: unknown;
  googleMapsUri?: unknown;
  imageUrl?: unknown;
  address?: unknown;
  locality?: unknown;
  attributions?: unknown;
};

export type NearbyPlace = {
  id: string;
  name: string;
  categoryLabel: string | null;
  distanceMeters: number | null;
  distanceLabel: string | null;
  googleMapsUri: string | null;
  imageUrl: string | null;
  attributions: string[];
};

export type NearbyQueryResult =
  | { status: 'disabled' }
  | { status: 'missing-coordinates' }
  | { status: 'hidden' }
  | { status: 'blocked' }
  | { status: 'aborted' }
  | { status: 'empty' }
  | { status: 'error'; reason: 'timeout' | 'unavailable' }
  | { status: 'success'; places: NearbyPlace[]; attribution: string };

export type NearbyFetchResult =
  | { status: 'blocked' }
  | { status: 'ok'; places: NearbyRawPlace[]; attribution: string };

export type NearbyLoaderQuery = {
  eventId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  includedTypes: readonly string[];
  limit: number;
  fieldMask: readonly string[];
};

export type NearbyLoader = (
  query: NearbyLoaderQuery,
  signal: AbortSignal,
) => Promise<NearbyFetchResult>;

export type NearbyLoadPlan =
  | 'skip-disabled'
  | 'skip-coordinates'
  | 'skip-hidden'
  | 'skip-provider'
  | 'load';

type Inflight = {
  promise: Promise<NearbyQueryResult>;
  controller: AbortController;
  listeners: number;
};

const inflight = new Map<string, Inflight>();

export function nearbyFieldMaskStaysOnProSku(mask: readonly string[] = NEARBY_FIELD_MASK): boolean {
  return mask.every((field) =>
    ENTERPRISE_FIELD_MARKERS.every((marker) => !field.toLowerCase().includes(marker.toLowerCase())),
  );
}

export function isValidNearbyCoordinate(latitude: number | null, longitude: number | null): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  return true;
}

export function planNearbyLoad(input: {
  featureEnabled: boolean;
  providerAvailable: boolean;
  visible: boolean;
  latitude: number | null;
  longitude: number | null;
}): NearbyLoadPlan {
  if (!input.featureEnabled) return 'skip-disabled';
  if (!isValidNearbyCoordinate(input.latitude, input.longitude)) return 'skip-coordinates';
  if (!input.visible) return 'skip-hidden';
  if (!input.providerAvailable) return 'skip-provider';
  return 'load';
}

export function shouldRevealNearbySection(
  anchorY: number | null,
  scrollY: number,
  viewportHeight: number,
  prefetchPx = NEARBY_VIEWPORT_PREFETCH_PX,
): boolean {
  if (anchorY == null || !Number.isFinite(anchorY) || !Number.isFinite(scrollY)) return false;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return false;
  return scrollY + viewportHeight + prefetchPx >= anchorY;
}

export function shouldApplyNearbyResult(
  requestId: number,
  currentRequestId: number,
): boolean {
  return requestId === currentRequestId;
}

export function parseNearbyEventId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return EVENT_ID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function resolveNearbyResultLimit(configuredMax?: unknown): number {
  const cap = typeof configuredMax === 'number' && Number.isFinite(configuredMax)
    ? Math.floor(configuredMax)
    : NEARBY_RESULT_LIMIT;
  if (cap < 1) return 1;
  return Math.min(NEARBY_RESULT_LIMIT, cap);
}

export function resolveNearbyTimeoutMs(configured?: unknown): number {
  const value = typeof configured === 'number' && Number.isFinite(configured)
    ? Math.floor(configured)
    : NEARBY_TIMEOUT_MS;
  return Math.min(15_000, Math.max(1_000, value));
}

function runtimeTimeoutMs(configured?: unknown): number {
  if (typeof configured !== 'number' || !Number.isFinite(configured)) return NEARBY_TIMEOUT_MS;
  return Math.min(15_000, Math.max(10, Math.floor(configured)));
}

export function decideNearbyServerRequest(input: {
  featureEnabled: boolean;
  body: unknown;
  eventStatus: string | null;
  maxResults?: unknown;
}): { ok: true; eventId: string; limit: number } | { ok: false; httpStatus: 400 | 404 } {
  if (!input.featureEnabled) return { ok: false, httpStatus: 404 };
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
    return { ok: false, httpStatus: 400 };
  }
  const record = input.body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'eventId') return { ok: false, httpStatus: 400 };
  const eventId = parseNearbyEventId(record.eventId);
  if (!eventId) return { ok: false, httpStatus: 400 };
  if (input.eventStatus !== 'published') return { ok: false, httpStatus: 404 };
  return { ok: true, eventId, limit: resolveNearbyResultLimit(input.maxResults) };
}

export function distanceMeters(
  origin: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(target.latitude - origin.latitude);
  const dLon = toRad(target.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(target.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearbySearchRadiusDegrees(latitude: number, radiusMeters = NEARBY_RADIUS_METERS): number {
  const latRadians = (latitude * Math.PI) / 180;
  const latitudeDegrees = radiusMeters / 111_320;
  const longitudeDegrees = radiusMeters / Math.max(1, 111_320 * Math.cos(latRadians));
  return Math.min(10, Math.max(0.00001, Math.max(latitudeDegrees, longitudeDegrees) * 1.05));
}

export function buildPlaceViewUrl(place: {
  name?: string | null;
  address?: string | null;
  locality?: string | null;
}): string | null {
  const parts: string[] = [];
  for (const value of [place.name, place.address, place.locality]) {
    const part = cleanPlaceQueryPart(value);
    if (!part) continue;
    const folded = part.toLocaleLowerCase('fr');
    if (parts.some((item) => item.toLocaleLowerCase('fr').includes(folded))) continue;
    parts.push(part);
  }
  if (parts.length === 0) return null;
  return `https://www.google.com/search?q=${encodeURIComponent(parts.join(' '))}`;
}

export function buildPlaceImageUrl(
  latitude: number,
  longitude: number,
  token: string,
): string | null {
  if (!isValidNearbyCoordinate(latitude, longitude) || !token.startsWith('pk.')) return null;
  const lon = longitude.toFixed(5);
  const lat = latitude.toFixed(5);
  const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lon},${lat},16,0/400x220@2x`);
  url.searchParams.set('access_token', token);
  return url.toString();
}

function cleanPlaceQueryPart(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}

export function parseMapboxCategoryCollection(
  body: unknown,
  category: (typeof MAPBOX_NEARBY_CATEGORIES)[number],
): { places: NearbyRawPlace[]; attribution: string | null } {
  if (!body || typeof body !== 'object') return { places: [], attribution: null };
  const record = body as { features?: unknown; attribution?: unknown };
  const attribution = typeof record.attribution === 'string' && record.attribution.trim()
    ? record.attribution.trim()
    : null;
  const features = Array.isArray(record.features) ? record.features : [];
  const primaryType = category === 'coffee' ? 'cafe' : category;
  const places: NearbyRawPlace[] = [];
  for (const feature of features) {
    const place = mapboxFeatureToRawPlace(feature, primaryType);
    if (place) places.push(place);
  }
  return { places, attribution };
}

function mapboxFeatureToRawPlace(feature: unknown, primaryType: string): NearbyRawPlace | null {
  if (!feature || typeof feature !== 'object') return null;
  const properties = (feature as { properties?: unknown }).properties;
  if (!properties || typeof properties !== 'object') return null;
  const record = properties as {
    mapbox_id?: unknown;
    name?: unknown;
    name_preferred?: unknown;
    poi_category_ids?: unknown;
    address?: unknown;
    context?: { place?: { name?: unknown } };
    coordinates?: { latitude?: unknown; longitude?: unknown };
  };
  const id = typeof record.mapbox_id === 'string' ? record.mapbox_id.trim() : '';
  const name = readName(record.name_preferred) ?? readName(record.name);
  const latitude = typeof record.coordinates?.latitude === 'number' ? record.coordinates.latitude : null;
  const longitude = typeof record.coordinates?.longitude === 'number' ? record.coordinates.longitude : null;
  if (!id || !name || !isValidNearbyCoordinate(latitude, longitude)) return null;
  const types = readTypes(record.poi_category_ids);
  const address = readName(record.address);
  const locality = readName(record.context?.place?.name);
  return {
    id,
    name,
    address,
    locality,
    primaryType,
    types: types.includes(primaryType) ? types : [primaryType, ...types],
    latitude,
    longitude,
    googleMapsUri: buildPlaceViewUrl({ name, address, locality }),
  };
}

export function formatCrowDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) {
    return `${Math.round(meters)} m à vol d’oiseau`;
  }
  const kilometers = meters / 1000;
  const rounded = kilometers < 10 ? Math.round(kilometers * 10) / 10 : Math.round(kilometers);
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${label} km à vol d’oiseau`;
}

export function isOfficialGoogleMapsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'www.google.com' || host === 'google.com') {
    if (url.pathname === '/search') return isGoogleEstablishmentSearch(url);
    return url.pathname === '/maps' || url.pathname.startsWith('/maps/');
  }
  return host === 'maps.google.com' || host === 'maps.app.goo.gl';
}

function isGoogleEstablishmentSearch(url: URL): boolean {
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== 'q') return false;
  const query = url.searchParams.get('q')?.trim() ?? '';
  return query.length > 0 && !query.includes('://');
}

export async function openOfficialPlaceUrl(
  url: string | null,
  openUrl: (target: string) => Promise<void>,
): Promise<'opened' | 'rejected' | 'unavailable'> {
  if (!isOfficialGoogleMapsUrl(url) || !url) return 'unavailable';
  try {
    await openUrl(url);
    return 'opened';
  } catch {
    return 'rejected';
  }
}

export function normalizeNearbyPlaces(
  rawPlaces: NearbyRawPlace[],
  origin: { latitude: number; longitude: number },
  limit = NEARBY_RESULT_LIMIT,
): NearbyPlace[] {
  const places: NearbyPlace[] = [];
  for (const raw of rawPlaces) {
    const place = normalizeOne(raw, origin);
    if (place) places.push(place);
  }
  places.sort((a, b) => {
    if (a.distanceMeters == null && b.distanceMeters == null) return 0;
    if (a.distanceMeters == null) return 1;
    if (b.distanceMeters == null) return -1;
    return a.distanceMeters - b.distanceMeters;
  });
  return places.slice(0, resolveNearbyResultLimit(limit));
}

export function resetNearbyInflightForTests(): void {
  for (const slot of inflight.values()) slot.controller.abort();
  inflight.clear();
}

export async function executeNearbyQuery(
  input: {
    featureEnabled: boolean;
    providerAvailable: boolean;
    visible: boolean;
    eventId: string;
    latitude: number | null;
    longitude: number | null;
  },
  options: {
    loader: NearbyLoader;
    signal?: AbortSignal;
    timeoutMs?: number;
    limit?: number;
  },
): Promise<NearbyQueryResult> {
  const plan = planNearbyLoad(input);
  if (plan === 'skip-disabled') return { status: 'disabled' };
  if (plan === 'skip-coordinates') return { status: 'missing-coordinates' };
  if (plan === 'skip-hidden') return { status: 'hidden' };
  if (plan === 'skip-provider') return { status: 'blocked' };

  const latitude = input.latitude as number;
  const longitude = input.longitude as number;
  const limit = resolveNearbyResultLimit(options.limit);
  const timeoutMs = runtimeTimeoutMs(options.timeoutMs);
  const key = `${input.eventId}:${latitude}:${longitude}:${limit}`;

  let slot = inflight.get(key);
  if (!slot) {
    const controller = new AbortController();
    const promise = runLoader(
      options.loader,
      {
        eventId: input.eventId,
        latitude,
        longitude,
        radiusMeters: NEARBY_RADIUS_METERS,
        includedTypes: NEARBY_INCLUDED_TYPES,
        limit,
        fieldMask: NEARBY_FIELD_MASK,
      },
      controller,
      timeoutMs,
    ).finally(() => {
      const current = inflight.get(key);
      if (current?.controller === controller) inflight.delete(key);
    });
    slot = { promise, controller, listeners: 0 };
    inflight.set(key, slot);
  }

  slot.listeners += 1;
  let released = false;
  const release = (abort: boolean) => {
    if (released) return;
    released = true;
    slot!.listeners -= 1;
    if (abort && slot!.listeners <= 0) slot!.controller.abort();
  };

  const parent = options.signal;
  if (parent?.aborted) {
    release(true);
    return { status: 'aborted' };
  }
  const onParentAbort = () => release(true);
  parent?.addEventListener('abort', onParentAbort);

  try {
    const result = await slot.promise;
    if (parent?.aborted) return { status: 'aborted' };
    return result;
  } catch {
    if (parent?.aborted) return { status: 'aborted' };
    return { status: 'error', reason: 'unavailable' };
  } finally {
    parent?.removeEventListener('abort', onParentAbort);
    release(false);
  }
}

async function runLoader(
  loader: NearbyLoader,
  query: NearbyLoaderQuery,
  controller: AbortController,
  timeoutMs: number,
): Promise<NearbyQueryResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ kind: 'timeout' }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: 'timeout' });
    }, timeoutMs);
  });
  const loaded = loader(query, controller.signal).then(
    (value) => ({ kind: 'value' as const, value }),
    (error: unknown) => ({ kind: 'error' as const, error }),
  );

  try {
    const raced = await Promise.race([loaded, timeout]);
    if (raced.kind === 'timeout') return { status: 'error', reason: 'timeout' };
    if (raced.kind === 'error') {
      if (isAbortError(raced.error) || controller.signal.aborted) return { status: 'aborted' };
      return { status: 'error', reason: 'unavailable' };
    }
    if (raced.value.status === 'blocked') return { status: 'blocked' };
    const places = normalizeNearbyPlaces(
      Array.isArray(raced.value.places) ? raced.value.places : [],
      { latitude: query.latitude, longitude: query.longitude },
      query.limit,
    ).filter((place) => place.distanceMeters != null && place.distanceMeters <= NEARBY_RADIUS_METERS);
    if (places.length === 0) return { status: 'empty' };
    const attribution = raced.value.attribution.trim();
    if (!attribution) return { status: 'error', reason: 'unavailable' };
    return { status: 'success', places, attribution };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeOne(
  raw: NearbyRawPlace,
  origin: { latitude: number; longitude: number },
): NearbyPlace | null {
  const id = readId(raw.id);
  const name = readName(raw.name) ?? readName(raw.displayName);
  if (!id || !name) return null;

  const types = readTypes(raw.types);
  const primaryType = readToken(raw.primaryType);
  if (types.length > 0 && !types.some((type) => ALLOWED_TYPES.has(type)) && !(primaryType && ALLOWED_TYPES.has(primaryType))) {
    return null;
  }

  const coords = readCoords(raw);
  const distance = coords ? distanceMeters(origin, coords) : null;
  const uri = readUri(raw.googleMapsUri);
  return {
    id,
    name,
    categoryLabel: categoryLabel(types, primaryType),
    distanceMeters: distance,
    distanceLabel: formatCrowDistance(distance),
    googleMapsUri: uri,
    imageUrl: readImageUrl(raw.imageUrl),
    attributions: readAttributions(raw.attributions),
  };
}

function categoryLabel(types: string[], primaryType: string | null): string | null {
  if (primaryType && CATEGORY_LABELS[primaryType]) return CATEGORY_LABELS[primaryType];
  for (const type of types) {
    const label = CATEGORY_LABELS[type];
    if (label) return label;
  }
  return null;
}

function readId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

function readName(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (value && typeof value === 'object' && 'text' in value) {
    const text = (value as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return null;
}

function readToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function readTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function readCoords(raw: NearbyRawPlace): { latitude: number; longitude: number } | null {
  const directLat = typeof raw.latitude === 'number' ? raw.latitude : null;
  const directLon = typeof raw.longitude === 'number' ? raw.longitude : null;
  if (isValidNearbyCoordinate(directLat, directLon)) {
    return { latitude: directLat as number, longitude: directLon as number };
  }
  if (raw.location && typeof raw.location === 'object') {
    const location = raw.location as { latitude?: unknown; longitude?: unknown };
    const latitude = typeof location.latitude === 'number' ? location.latitude : null;
    const longitude = typeof location.longitude === 'number' ? location.longitude : null;
    if (isValidNearbyCoordinate(latitude, longitude)) {
      return { latitude: latitude as number, longitude: longitude as number };
    }
  }
  return null;
}

function readUri(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return isOfficialGoogleMapsUrl(value) ? value : null;
}

function readImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  if (url.hostname !== 'api.mapbox.com') return null;
  if (!url.pathname.startsWith('/styles/v1/') || !url.pathname.includes('/static/')) return null;
  if (url.pathname.includes('pin-') || url.pathname.includes('url-')) return null;
  return url.toString();
}

function readAttributions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const item of value) {
    const text = typeof item === 'string'
      ? item
      : item && typeof item === 'object' && 'text' in item && typeof (item as { text?: unknown }).text === 'string'
        ? (item as { text: string }).text
        : '';
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed) || trimmed === GOOGLE_MAPS_ATTRIBUTION) continue;
    seen.add(trimmed);
    lines.push(trimmed);
  }
  return lines.slice(0, 5);
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError');
}
