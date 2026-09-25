import type { EventWithCreator } from '@/types/database';
import { isEventPast } from './event-status';

export type AgendaBucketId = 'interested' | 'participating' | 'organizing' | 'past';

export type AgendaMembershipSets = {
  interestedIds: Iterable<string>;
  participatingIds: Iterable<string>;
  organizingIds: Iterable<string>;
};

export type AgendaFlags = {
  checkin: boolean;
  eventCreate: boolean;
};

const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfLocalDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

/** ISO week: Monday is the first day. */
export function startOfWeekMonday(date: Date): Date {
  const value = startOfLocalDay(date);
  const weekday = value.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  value.setDate(value.getDate() + offset);
  return value;
}

export function shiftWeek(date: Date, deltaWeeks: number): Date {
  const value = startOfWeekMonday(date);
  value.setDate(value.getDate() + deltaWeeks * 7);
  return value;
}

export function shiftMonth(date: Date, deltaMonths: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1);
}

/** Full month, Monday-first, including the leading and trailing days of adjacent months. */
export function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeekMonday(first);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function eventOverlapsLocalRange(
  event: Pick<EventWithCreator, 'starts_at' | 'ends_at'>,
  start: Date,
  end: Date,
): boolean {
  const eventStart = event.starts_at ? new Date(event.starts_at) : null;
  if (!eventStart || Number.isNaN(eventStart.getTime())) return false;
  const parsedEnd = event.ends_at ? new Date(event.ends_at) : null;
  const eventEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : eventStart;
  const rangeStart = startOfLocalDay(start.getTime() <= end.getTime() ? start : end);
  const rangeEnd = endOfLocalDay(start.getTime() <= end.getTime() ? end : start);
  return eventStart.getTime() <= rangeEnd.getTime() && eventEnd.getTime() >= rangeStart.getTime();
}

export function likedEventsInRange(
  events: EventWithCreator[],
  start: Date,
  end: Date,
): EventWithCreator[] {
  return events
    .filter((event) => eventOverlapsLocalRange(event, start, end))
    .sort((left, right) => Date.parse(left.starts_at || '') - Date.parse(right.starts_at || ''));
}

export function buildWeekDays(anchor: Date): Date[] {
  const monday = startOfWeekMonday(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function formatWeekdayShort(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()] ?? '';
}

export function formatMonthTitle(date: Date): string {
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.toUpperCase();
}

export function formatActivityCount(count: number): string {
  return count === 1 ? '1 activité' : `${count} activités`;
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return toLocalDateKey(left) === toLocalDateKey(right);
}

export function eventOverlapsLocalDay(
  event: Pick<EventWithCreator, 'starts_at' | 'ends_at'>,
  day: Date,
): boolean {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  if (!start || Number.isNaN(start.getTime())) return false;
  const parsedEnd = event.ends_at ? new Date(event.ends_at) : null;
  const end = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : start;
  const dayStart = startOfLocalDay(day);
  const dayEnd = endOfLocalDay(day);
  return start.getTime() <= dayEnd.getTime() && end.getTime() >= dayStart.getTime();
}

function toIdSet(ids: Iterable<string>): Set<string> {
  return ids instanceof Set ? ids : new Set(ids);
}

export function resolveAgendaBucket(
  event: EventWithCreator,
  sets: AgendaMembershipSets,
  now: Date = new Date(),
): AgendaBucketId | null {
  const interested = toIdSet(sets.interestedIds);
  const participating = toIdSet(sets.participatingIds);
  const organizing = toIdSet(sets.organizingIds);
  const known =
    interested.has(event.id) || participating.has(event.id) || organizing.has(event.id);
  if (!known) return null;
  if (isEventPast(event, now)) return 'past';
  if (organizing.has(event.id)) return 'organizing';
  if (participating.has(event.id)) return 'participating';
  return 'interested';
}

export function visibleAgendaBuckets(flags: AgendaFlags): AgendaBucketId[] {
  const buckets: AgendaBucketId[] = ['interested'];
  if (flags.checkin) buckets.push('participating');
  if (flags.eventCreate) buckets.push('organizing');
  buckets.push('past');
  return buckets;
}

export function filterAgendaBucketEvents(
  events: EventWithCreator[],
  bucket: AgendaBucketId,
  sets: AgendaMembershipSets,
  options?: { day?: Date | null; now?: Date },
): EventWithCreator[] {
  const now = options?.now ?? new Date();
  const day = options?.day ?? null;
  return events.filter((event) => {
    if (resolveAgendaBucket(event, sets, now) !== bucket) return false;
    if (bucket === 'past') return true;
    if (!day) return true;
    return eventOverlapsLocalDay(event, day);
  });
}

export function countAgendaDayActivities(
  events: EventWithCreator[],
  day: Date,
  sets: AgendaMembershipSets,
  flags: AgendaFlags,
  now: Date = new Date(),
): number {
  const visible = new Set(visibleAgendaBuckets(flags));
  const unique = new Set<string>();
  for (const event of events) {
    const bucket = resolveAgendaBucket(event, sets, now);
    if (!bucket || !visible.has(bucket)) continue;
    if (bucket === 'past') continue;
    if (!eventOverlapsLocalDay(event, day)) continue;
    unique.add(event.id);
  }
  return unique.size;
}

export function daysWithAgendaActivity(
  events: EventWithCreator[],
  days: Date[],
  sets: AgendaMembershipSets,
  flags: AgendaFlags,
  now: Date = new Date(),
): Set<string> {
  const marked = new Set<string>();
  for (const day of days) {
    if (countAgendaDayActivities(events, day, sets, flags, now) > 0) {
      marked.add(toLocalDateKey(day));
    }
  }
  return marked;
}

export function groupAgendaEventsByDay(
  events: EventWithCreator[],
): { key: string; label: string; events: EventWithCreator[] }[] {
  const groups = new Map<string, EventWithCreator[]>();
  const orderedKeys: string[] = [];
  for (const event of events) {
    const start = event.starts_at ? new Date(event.starts_at) : null;
    const key = start && !Number.isNaN(start.getTime()) ? toLocalDateKey(start) : 'unknown';
    if (!groups.has(key)) {
      groups.set(key, []);
      orderedKeys.push(key);
    }
    groups.get(key)?.push(event);
  }
  orderedKeys.sort();
  return orderedKeys.map((key) => {
    const items = groups.get(key) ?? [];
    const sample = items[0]?.starts_at ? new Date(items[0].starts_at) : null;
    const label =
      key === 'unknown' || !sample || Number.isNaN(sample.getTime())
        ? 'Date à confirmer'
        : sample.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
    const capitalized = label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
    return { key, label: capitalized, events: items };
  });
}

export const AGENDA_BUCKET_COPY: Record<
  AgendaBucketId,
  { title: string; emptyTitle: string; emptySubtitle: string }
> = {
  interested: {
    title: 'Je suis intéressé(e)',
    emptyTitle: 'Aucun moment noté ce jour-là',
    emptySubtitle: 'Touchez le cœur d’un moment pour le retrouver ici.',
  },
  participating: {
    title: 'Je participe',
    emptyTitle: 'Aucune participation',
    emptySubtitle: 'Quand le check-in sera ouvert, tes présences apparaîtront ici.',
  },
  organizing: {
    title: 'J’organise',
    emptyTitle: 'Aucun moment organisé',
    emptySubtitle: 'Tes publications apparaîtront ici dès que la création sera ouverte.',
  },
  past: {
    title: 'Passées',
    emptyTitle: 'Aucune activité passée',
    emptySubtitle: 'Les moments terminés que tu as notés resteront lisibles ici.',
  },
};
