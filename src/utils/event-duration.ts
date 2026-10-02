import type { EventWithCreator } from '../types/database';
import type { EventDurationBucket } from '../types/filters';

/** Inclusive calendar-day span. Day 3 is exceptional; day 4 is short. */
export const EXCEPTIONAL_EVENT_MAX_DAYS = 3;
/** Inclusive calendar-day span. Day 14 is short; day 15 is long. */
export const SHORT_EVENT_MAX_DAYS = 14;

const DURATION_ORDER: readonly EventDurationBucket[] = ['exceptional', 'short', 'long'];

/**
 * Span is the inclusive local calendar days from starts_at through ends_at.
 * The three buckets are exclusive: exceptionnel is 1–3 days, court is 4–14 days,
 * long is 15 days or more. An empty selection keeps every event. A non-empty
 * selection keeps only events in the chosen buckets, so unknown bounds drop out.
 * Recurring schedules do not replace this publication span.
 */
export type EventSpanDuration = EventDurationBucket | 'unknown';

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

type DurationEvent = Pick<EventWithCreator, 'starts_at' | 'ends_at'>;

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})T/;
const MS_PER_DAY = 86_400_000;

function localCalendarDate(value: string): string | null {
  const explicitDate = ISO_DATE_PREFIX.exec(value)?.[1];
  if (explicitDate) return explicitDate;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inclusiveCalendarDays(startsAt: string, endsAt: string): number | null {
  const startDate = localCalendarDate(startsAt);
  const endDate = localCalendarDate(endsAt);
  if (!startDate || !endDate) return null;
  const startUtc = Date.parse(`${startDate}T00:00:00Z`);
  const endUtc = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(startUtc) || Number.isNaN(endUtc) || endUtc < startUtc) return null;
  return Math.round((endUtc - startUtc) / MS_PER_DAY) + 1;
}

export function classifyEventSpan(event: DurationEvent): EventSpanDuration {
  if (!event.starts_at || !event.ends_at) return 'unknown';
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 'unknown';
  }

  const days = inclusiveCalendarDays(event.starts_at, event.ends_at);
  if (days === null || days <= 0) return 'unknown';
  if (days <= EXCEPTIONAL_EVENT_MAX_DAYS) return 'exceptional';
  if (days <= SHORT_EVENT_MAX_DAYS) return 'short';
  return 'long';
}

export function eventMatchesDuration(
  event: DurationEvent,
  duration: readonly EventDurationBucket[] | undefined
): boolean {
  const selected = normalizeDurationSelection(duration);
  if (selected.length === 0) return true;
  const span = classifyEventSpan(event);
  return span !== 'unknown' && selected.includes(span);
}
