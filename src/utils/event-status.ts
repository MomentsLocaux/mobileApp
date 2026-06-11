type EventLike = {
  starts_at?: string | null;
  ends_at?: string | null;
  operating_hours?: unknown;
};

type TimeSlot = { opens: string; closes: string };

type ParsedFrenchOccurrence = {
  year: number;
  month: number;
  day: number;
  startH: number;
  startM: number;
  endH: number | null;
  endM: number | null;
};

export type EventLiveWindow = {
  isLive: boolean;
  liveUntil: Date | null;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map((v) => Number(v));
  return hours * 60 + minutes;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoWeekDay = (date: Date) => {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
};

const toDateWithTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map((v) => Number(v));
  const value = new Date(date);
  value.setHours(hours || 0, minutes || 0, 0, 0);
  return value;
};

const endOfLocalDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const toLocalDateTime = (year: number, month: number, day: number, hour: number, minute: number) => {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

const normalizeFrenchText = (line: string) =>
  line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const parseTimeOfDay = (line: string): Pick<ParsedFrenchOccurrence, 'startH' | 'startM' | 'endH' | 'endM'> | null => {
  const normalized = normalizeFrenchText(line);

  const range = normalized.match(/\bde\s+(\d{1,2}):(\d{2})\s+a\s+(\d{1,2}):(\d{2})/);
  if (range) {
    return {
      startH: Number(range[1]),
      startM: Number(range[2]),
      endH: Number(range[3]),
      endM: Number(range[4]),
    };
  }

  const openStart = normalized.match(/\ba\s+partir\s+de\s+(\d{1,2}):(\d{2})/);
  if (openStart) {
    return { startH: Number(openStart[1]), startM: Number(openStart[2]), endH: null, endM: null };
  }

  const single = normalized.match(/(\d{1,2}):(\d{2})/);
  if (single) {
    return { startH: Number(single[1]), startM: Number(single[2]), endH: null, endM: null };
  }

  return null;
};

export const parseFrenchScheduleLine = (line: string): ParsedFrenchOccurrence | null => {
  const normalized = normalizeFrenchText(line);
  const dateMatch = normalized.match(
    /\ble\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/i,
  );
  if (!dateMatch) return null;

  const day = Number(dateMatch[1]);
  const month = FRENCH_MONTHS[dateMatch[2]];
  const year = Number(dateMatch[3]);
  if (!month) return null;

  const time = parseTimeOfDay(line);
  return {
    year,
    month,
    day,
    startH: time?.startH ?? 0,
    startM: time?.startM ?? 0,
    endH: time?.endH ?? null,
    endM: time?.endM ?? null,
  };
};

const parseSlot = (raw: any): TimeSlot | null => {
  const opens = typeof raw?.opens === 'string' ? raw.opens : raw?.start;
  const closes = typeof raw?.closes === 'string' ? raw.closes : raw?.end;
  if (!opens || !closes || !TIME_PATTERN.test(opens) || !TIME_PATTERN.test(closes)) return null;
  if (toMinutes(closes) <= toMinutes(opens)) return null;
  return { opens, closes };
};

const parseSlots = (slots: any): TimeSlot[] => {
  if (!Array.isArray(slots)) return [];
  return slots.map(parseSlot).filter((slot): slot is TimeSlot => !!slot);
};

export const getTextScheduleLines = (operatingHours: unknown): string[] => {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) return [];
  return operatingHours
    .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    .map((line) => line.trim());
};

export const hasEventScheduleDetails = (operatingHours: unknown): boolean => {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) return false;
  return operatingHours.some((row: any) => typeof row === 'object' && row !== null && parseSlots(row?.slots).length > 0);
};

const getStructuredSlotsForNow = (operatingHours: unknown, now: Date): TimeSlot[] => {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) return [];
  const todayKey = toLocalDateKey(now);
  const weekDay = toIsoWeekDay(now);
  const rows = operatingHours as any[];

  const dayRows = rows.filter((row) => row?.kind === 'day' && row?.date === todayKey);
  if (dayRows.length > 0) {
    return dayRows.flatMap((row) => parseSlots(row?.slots));
  }

  const singleDay = rows.find((row) => row?.kind === 'single_day' && row?.date === todayKey);
  if (singleDay) {
    return parseSlots(singleDay?.slots);
  }

  const fixed = rows.find((row) => row?.kind === 'fixed');
  if (fixed) {
    const openDays = Array.isArray(fixed?.open_days) ? fixed.open_days : [];
    if (openDays.includes(weekDay)) {
      return parseSlots(fixed?.slots);
    }
    return [];
  }

  return [];
};

const getOccurrenceBounds = (occurrence: ParsedFrenchOccurrence): { start: Date; end: Date } => {
  const start = toLocalDateTime(occurrence.year, occurrence.month, occurrence.day, occurrence.startH, occurrence.startM);
  const end =
    occurrence.endH !== null
      ? toLocalDateTime(
          occurrence.year,
          occurrence.month,
          occurrence.day,
          occurrence.endH,
          occurrence.endM ?? 0,
        )
      : endOfLocalDay(start);
  return { start, end };
};

const getLiveWindowFromTextSchedule = (operatingHours: unknown, now: Date): EventLiveWindow => {
  const lines = getTextScheduleLines(operatingHours);
  const todayKey = toLocalDateKey(now);

  for (const line of lines) {
    const parsed = parseFrenchScheduleLine(line);
    if (!parsed) continue;

    const lineKey = `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
    if (lineKey !== todayKey) continue;

    const { start, end } = getOccurrenceBounds(parsed);
    if (now >= start && now <= end) {
      return { isLive: true, liveUntil: end };
    }
  }

  return { isLive: false, liveUntil: null };
};

/** Effective end when ends_at is missing — end of the start day, not "forever". */
export const resolveDefaultEventEnd = (event: EventLike): Date | null => {
  if (!event?.starts_at) return null;
  const startsAt = new Date(event.starts_at);
  if (Number.isNaN(startsAt.getTime())) return null;

  if (event.ends_at) {
    const endsAt = new Date(event.ends_at);
    if (!Number.isNaN(endsAt.getTime())) return endsAt;
  }

  return endOfLocalDay(startsAt);
};

const getLatestOccurrenceEnd = (operatingHours: unknown): Date | null => {
  const lines = getTextScheduleLines(operatingHours);
  let latest: Date | null = null;

  for (const line of lines) {
    const parsed = parseFrenchScheduleLine(line);
    if (!parsed) continue;
    const { end } = getOccurrenceBounds(parsed);
    if (!latest || end > latest) latest = end;
  }

  return latest;
};

export const getEffectiveEventEnd = (event: EventLike, now: Date = new Date()): Date | null => {
  const latestOccurrence = getLatestOccurrenceEnd(event.operating_hours);
  if (latestOccurrence) return latestOccurrence;
  return resolveDefaultEventEnd(event);
};

export const isEventPast = (event: EventLike | null | undefined, now: Date = new Date()): boolean => {
  if (!event?.starts_at) return true;
  const effectiveEnd = getEffectiveEventEnd(event, now);
  if (!effectiveEnd) return false;
  return effectiveEnd < now;
};

/** Event has not started yet (strictly future start). */
export const isEventUpcoming = (event: EventLike | null | undefined, now: Date = new Date()): boolean => {
  if (!event?.starts_at) return false;
  if (isEventPast(event, now) || isEventLive(event, now)) return false;
  const startsAt = new Date(event.starts_at);
  return !Number.isNaN(startsAt.getTime()) && startsAt > now;
};

const isWithinGlobalWindow = (startsAt: Date, endsAt: Date, now: Date): boolean => {
  if (now < startsAt) return false;
  if (now > endsAt) return false;
  return true;
};

/**
 * Determines whether an event is "live" right now.
 * - Structured operating_hours: today's slot required.
 * - Scraper text lines ("Le vendredi 5 juin…"): only live on matching calendar days.
 * - Otherwise: starts_at/ends_at, with ends_at defaulting to end of start day (never infinite).
 */
export const getEventLiveWindow = (
  event: EventLike | null | undefined,
  now: Date = new Date(),
): EventLiveWindow => {
  if (!event?.starts_at) return { isLive: false, liveUntil: null };

  const startsAt = new Date(event.starts_at);
  if (Number.isNaN(startsAt.getTime())) return { isLive: false, liveUntil: null };

  if (hasEventScheduleDetails(event.operating_hours)) {
    const endsAt = event.ends_at ? new Date(event.ends_at) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) return { isLive: false, liveUntil: null };
    if (now < startsAt) return { isLive: false, liveUntil: null };
    if (endsAt && now > endsAt) return { isLive: false, liveUntil: null };

    const slots = getStructuredSlotsForNow(event.operating_hours, now);
    if (slots.length === 0) {
      return { isLive: false, liveUntil: null };
    }

    for (const slot of slots) {
      const slotStart = toDateWithTime(now, slot.opens);
      const slotEnd = toDateWithTime(now, slot.closes);
      if (now >= slotStart && now <= slotEnd) {
        const liveUntil = endsAt && endsAt < slotEnd ? endsAt : slotEnd;
        return { isLive: true, liveUntil };
      }
    }

    return { isLive: false, liveUntil: null };
  }

  const textLines = getTextScheduleLines(event.operating_hours);
  if (textLines.length > 0) {
    return getLiveWindowFromTextSchedule(event.operating_hours, now);
  }

  const effectiveEnd = resolveDefaultEventEnd(event);
  if (!effectiveEnd) return { isLive: false, liveUntil: null };

  if (!isWithinGlobalWindow(startsAt, effectiveEnd, now)) {
    return { isLive: false, liveUntil: null };
  }

  return { isLive: true, liveUntil: effectiveEnd };
};

export const isEventLive = (event: EventLike | null | undefined, now: Date = new Date()): boolean => {
  return getEventLiveWindow(event, now).isLive;
};
