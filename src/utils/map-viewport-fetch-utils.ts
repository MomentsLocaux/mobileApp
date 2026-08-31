import type { EventTimeScope } from '@/utils/event-time-scope';

type BboxParams = {
  ne: [number, number];
  sw: [number, number];
  limit: number;
};

export const RPC_CLIENT_TIMEOUT_MS = 4000;

export type ViewportCacheDisposition = 'fresh' | 'stale' | 'expired';

export const getViewportCacheDisposition = (
  storedAt: number,
  now: number,
  freshMs: number,
  maxStaleMs: number
): ViewportCacheDisposition => {
  const ageMs = Math.max(0, now - storedAt);
  if (ageMs <= freshMs) return 'fresh';
  if (ageMs <= maxStaleMs) return 'stale';
  return 'expired';
};

export const buildMapViewportCacheKey = (
  bbox: BboxParams,
  timeScope: EventTimeScope,
  options?: { mergeUpcomingForDatePreset?: boolean }
) =>
  [
    bbox.ne[0],
    bbox.ne[1],
    bbox.sw[0],
    bbox.sw[1],
    bbox.limit,
    timeScope,
    options?.mergeUpcomingForDatePreset ? 1 : 0,
  ].join('|');

/** Race against a client timeout and always clear the timer when the RPC settles first. */
export async function raceWithViewportTimeout<T>(
  promise: Promise<T>,
  timeoutMs = RPC_CLIENT_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('list_map_viewport client timeout'), { code: '57014' }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
