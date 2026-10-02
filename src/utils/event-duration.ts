import type { EventWithCreator } from '../types/database';
import type { EventDurationBucket } from '../types/filters';

const DURATION_ORDER: readonly EventDurationBucket[] = ['exceptional', 'short', 'long'];

/** The generated database column is authoritative, including an explicit NULL. */
export function normalizeDurationBucket(value: unknown): EventDurationBucket | null {
  return value === 'exceptional' || value === 'short' || value === 'long' ? value : null;
}

export function normalizeDurationSelection(value: unknown): EventDurationBucket[] {
  const raw = Array.isArray(value) ? value : value == null || value === 'all' ? [] : [value];
  const selected = new Set(
    raw.filter(
      (item): item is EventDurationBucket =>
        item === 'exceptional' || item === 'short' || item === 'long'
    )
  );
  return DURATION_ORDER.filter((bucket) => selected.has(bucket));
}

export function eventMatchesDuration(
  event: Pick<EventWithCreator, 'duration_bucket'>,
  duration: readonly EventDurationBucket[] | undefined,
): boolean {
  const selected = normalizeDurationSelection(duration);
  if (selected.length === 0) return true;
  const bucket = normalizeDurationBucket(event.duration_bucket);
  return bucket !== null && selected.includes(bucket);
}
