import { normalizeDurationBucket } from './event-duration';

type BucketRow = { id: string; duration_bucket: unknown };
const BATCH_SIZE = 200;

/** Enrich flat legacy RPC payloads; never infer duration from dates. */
export async function hydrateDurationBuckets<T extends Record<string, unknown>>(
  rows: T[],
  fetchBuckets: (ids: string[]) => Promise<BucketRow[]>,
): Promise<(T & { duration_bucket: ReturnType<typeof normalizeDurationBucket> })[]> {
  const ids = [...new Set(rows.filter(row => row.duration_bucket === undefined).map(row => String(row.id)))];
  const buckets = new Map<string, ReturnType<typeof normalizeDurationBucket>>();
  // Bounded requests keep PostgREST URLs and response size small, including dense viewports.
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    const batch = await fetchBuckets(ids.slice(offset, offset + BATCH_SIZE));
    batch.forEach(row => buckets.set(row.id, normalizeDurationBucket(row.duration_bucket)));
  }
  return rows.map(row => ({
    ...row,
    duration_bucket: row.duration_bucket === undefined
      ? buckets.get(String(row.id)) ?? null
      : normalizeDurationBucket(row.duration_bucket),
  }));
}
