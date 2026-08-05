import Constants from 'expo-constants';
import type { MapboxLegSummary } from '@/screens/roadtrip/roadtrip-schedule';
import type { LatLng } from '@/screens/roadtrip/roadtrip.types';

const MAPBOX_TOKEN =
  Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

export type DirectionsResult = {
  legs: MapboxLegSummary[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
};

type MapboxStep = { geometry: { coordinates: [number, number][] } };
type MapboxLeg = { duration: number; distance: number; steps: MapboxStep[] };
type MapboxRoute = { duration: number; distance: number; legs: MapboxLeg[] };

/**
 * In-memory cache keyed by rounded waypoints: one Directions call per
 * distinct itinerary. A new call only happens when the route or its stops
 * change (~4 decimal places ≈ 11 m).
 */
const cache = new Map<string, DirectionsResult>();

const cacheKey = (waypoints: LatLng[]) =>
  waypoints.map((w) => `${w.longitude.toFixed(4)},${w.latitude.toFixed(4)}`).join(';');

/**
 * Driving route between waypoints (origin, stops, destination).
 *
 * Requests `steps=true` so each leg gets its own geometry: the temporal engine
 * needs per-leg polylines to estimate passage times. Max 10 waypoints
 * (origin + 8 stops + destination), well under Mapbox's limit of 25.
 */
export async function fetchDrivingRoute(waypoints: LatLng[]): Promise<DirectionsResult> {
  if (waypoints.length < 2) throw new Error('roadtrip: at least 2 waypoints required');
  if (waypoints.length > 10) throw new Error('roadtrip: max 10 waypoints (origin + 8 stops + destination)');
  if (!MAPBOX_TOKEN) throw new Error('roadtrip: Mapbox token missing (EXPO_PUBLIC_MAPBOX_TOKEN)');

  const key = cacheKey(waypoints);
  const cached = cache.get(key);
  if (cached) return cached;

  const coords = waypoints.map((w) => `${w.longitude},${w.latitude}`).join(';');
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&steps=true&alternatives=false&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`roadtrip: Directions API error (HTTP ${res.status})`);
  const data = (await res.json()) as { code?: string; routes?: MapboxRoute[] };
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) {
    throw new Error(`roadtrip: no route found (${data.code ?? 'unknown'})`);
  }

  const legs: MapboxLegSummary[] = route.legs.map((leg) => ({
    durationSeconds: leg.duration,
    distanceMeters: leg.distance,
    geometry: leg.steps.flatMap((step, stepIndex) =>
      // Steps share their boundary point; drop the duplicate.
      stepIndex === 0 ? step.geometry.coordinates : step.geometry.coordinates.slice(1),
    ),
  }));

  const result: DirectionsResult = {
    legs,
    totalDurationSeconds: route.duration,
    totalDistanceMeters: route.distance,
  };
  cache.set(key, result);
  return result;
}
