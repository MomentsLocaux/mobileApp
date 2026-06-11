/**
 * Dev-only instrumentation for map bottom sheet performance analysis.
 * Enable with EXPO_PUBLIC_MAP_SHEET_PERF_TRACE=1
 */
const ENABLED =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_MAP_SHEET_PERF_TRACE === '1';

const counts = new Map<string, number>();

export function traceMapSheetPerf(label: string, detail?: Record<string, unknown>) {
  if (!ENABLED) return;
  const next = (counts.get(label) ?? 0) + 1;
  counts.set(label, next);
  if (detail) {
    console.log(`[map-sheet-perf] ${label} #${next}`, detail);
  } else {
    console.log(`[map-sheet-perf] ${label} #${next}`);
  }
}

export function resetMapSheetPerfTrace() {
  counts.clear();
}

export function getMapSheetPerfCounts(): Record<string, number> {
  return Object.fromEntries(counts.entries());
}
