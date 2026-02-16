type EventLike = {
  starts_at?: string | null;
  ends_at?: string | null;
  operating_hours?: unknown;
};

type TimeSlot = { opens: string; closes: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map((v) => Number(v));
  return hours * 60 + minutes;
};

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

const getSlotsForNow = (operatingHours: unknown, now: Date): TimeSlot[] => {
  if (!operatingHours || !Array.isArray(operatingHours)) return [];
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

export const getEventLiveWindow = (event: EventLike | null | undefined, now: Date = new Date()) => {
  if (!event?.starts_at) return { isLive: false, liveUntil: null as Date | null };

  const startsAt = new Date(event.starts_at);
  if (Number.isNaN(startsAt.getTime())) return { isLive: false, liveUntil: null as Date | null };

  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) return { isLive: false, liveUntil: null as Date | null };
  if (now < startsAt) return { isLive: false, liveUntil: null as Date | null };
  if (endsAt && now > endsAt) return { isLive: false, liveUntil: null as Date | null };

  const slots = getSlotsForNow(event.operating_hours, now);
  if (slots.length > 0) {
    for (const slot of slots) {
      const slotStart = toDateWithTime(now, slot.opens);
      const slotEnd = toDateWithTime(now, slot.closes);
      if (now >= slotStart && now <= slotEnd) {
        const liveUntil = endsAt && endsAt < slotEnd ? endsAt : slotEnd;
        return { isLive: true, liveUntil };
      }
    }
    return { isLive: false, liveUntil: null as Date | null };
  }

  return { isLive: true, liveUntil: endsAt || null };
};

export const isEventLive = (event: EventLike | null | undefined, now: Date = new Date()): boolean => {
  return getEventLiveWindow(event, now).isLive;
};
