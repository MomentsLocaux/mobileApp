/**
 * Dev-only instrumentation for map viewport fetch analysis.
 * Enable with EXPO_PUBLIC_MAP_VIEWPORT_TRACE=1
 */
const ENABLED =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_MAP_VIEWPORT_TRACE === '1';

export type MapViewportFetchOutcome =
  | 'success'
  | 'timeout'
  | 'fallback'
  | 'retry'
  | 'stale-cache'
  | 'deduped'
  | 'error';

export function traceMapViewportFetch(
  label: string,
  detail?: Record<string, unknown> & { outcome?: MapViewportFetchOutcome }
) {
  if (!ENABLED) return;
  if (detail) {
    console.log(`[map-viewport] ${label}`, detail);
  } else {
    console.log(`[map-viewport] ${label}`);
  }
}
