import { getEffectiveEventEnd } from './event-status';
import type { EventWithCreator } from '@/types/database';

export type DatePreset = 'today' | 'tomorrow' | 'weekend';

const endOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

/** Weekend window used by date presets (local device timezone). */
export function getWeekendWindow(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday

  if (day === 0) {
    const start = startOfDay(now);
    return { start, end: endOfDay(now) };
  }

  if (day === 6) {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end: endOfDay(end) };
  }

  const start = startOfDay(now);
  const daysUntilSaturday = (6 - day + 7) % 7;
  start.setDate(start.getDate() + daysUntilSaturday);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end: endOfDay(end) };
}

export function getTodayWindow(now: Date = new Date()) {
  const start = startOfDay(now);
  return { start, end: endOfDay(start) };
}

export function getTomorrowWindow(now: Date = new Date()) {
  const start = startOfDay(now);
  start.setDate(start.getDate() + 1);
  return { start, end: endOfDay(start) };
}

/** True when the event's effective window overlaps [windowStart, windowEnd]. */
export function eventOverlapsWindow(
  event: Pick<EventWithCreator, 'starts_at' | 'ends_at' | 'operating_hours'>,
  windowStart: Date,
  windowEnd: Date,
  now: Date = new Date()
): boolean {
  if (!event?.starts_at) return false;
  const eventStart = new Date(event.starts_at);
  if (Number.isNaN(eventStart.getTime())) return false;
  const eventEnd = getEffectiveEventEnd(event, now);
  if (!eventEnd || Number.isNaN(eventEnd.getTime())) return false;
  return eventStart <= windowEnd && eventEnd >= windowStart;
}

export function eventMatchesDatePreset(
  event: Pick<EventWithCreator, 'starts_at' | 'ends_at' | 'operating_hours'>,
  preset: DatePreset,
  now: Date = new Date()
): boolean {
  if (preset === 'today') {
    const { start, end } = getTodayWindow(now);
    return eventOverlapsWindow(event, start, end, now);
  }
  if (preset === 'tomorrow') {
    const { start, end } = getTomorrowWindow(now);
    return eventOverlapsWindow(event, start, end, now);
  }
  const { start, end } = getWeekendWindow(now);
  return eventOverlapsWindow(event, start, end, now);
}
