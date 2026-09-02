export type EventScheduleSource = {
  starts_at?: string | null;
  ends_at?: string | null;
  operating_hours?: unknown;
};

export type EventScheduleModeMobile = 'single_day' | 'fixed' | 'variable';

export type EventTimeSlot = {
  start: string;
  end: string;
};

export type VariableDaySchedule = {
  enabled: boolean;
  slots: EventTimeSlot[];
};

export type VariableSchedules = Record<string, VariableDaySchedule>;

export type EventScheduleDraft = {
  startDate?: string;
  endDate?: string;
  scheduleMode: EventScheduleModeMobile;
  scheduleOpenDays: number[];
  scheduleFixedSlots: EventTimeSlot[];
  scheduleVariableDays: VariableSchedules;
};

export const DEFAULT_EVENT_TIME_SLOT: EventTimeSlot = { start: '09:00', end: '18:00' };

export const eventScheduleModeToDb = (mode: EventScheduleModeMobile): 'ponctuel' | 'recurrent' =>
  mode === 'single_day' ? 'ponctuel' : 'recurrent';

const DEFAULT_SLOT: EventTimeSlot = { start: '09:00', end: '18:00' };
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toDateOnly = (iso?: string) => (iso ? iso.split('T')[0] : '');

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map((v) => Number(v));
  return hours * 60 + minutes;
};

export const isValidTime = (value?: string | null) => !!value && TIME_PATTERN.test(value);

export const isValidSlot = (slot: EventTimeSlot) =>
  isValidTime(slot.start) && isValidTime(slot.end) && toMinutes(slot.end) > toMinutes(slot.start);

export const isSameDayRange = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return false;
  return toDateOnly(startDate) === toDateOnly(endDate);
};

const getIsoDay = (dateStr: string) => {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
};

export const enumerateDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return [];
  const start = new Date(`${toDateOnly(startDate)}T00:00:00.000Z`);
  const end = new Date(`${toDateOnly(endDate)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const hasValidSlots = (slots: EventTimeSlot[]) => slots.length > 0 && slots.every(isValidSlot);

export const validateEventSchedule = (params: {
  startDate?: string;
  endDate?: string;
  mode: EventScheduleModeMobile;
  fixedSlots: EventTimeSlot[];
  openDays: number[];
  variableSchedules: VariableSchedules;
}) => {
  const { startDate, endDate, mode, fixedSlots, openDays, variableSchedules } = params;
  if (!startDate || !endDate) return { valid: false, message: 'Les dates de début et fin sont obligatoires.' };

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, message: 'Les dates sélectionnées sont invalides.' };
  }
  if (end <= start) return { valid: false, message: 'La date de fin doit être après la date de début.' };

  const sameDay = isSameDayRange(startDate, endDate);
  if (sameDay) {
    if (mode !== 'single_day') return { valid: false, message: 'Pour une seule journée, utilisez le mode simple.' };
    return { valid: true };
  }

  if (mode === 'single_day') {
    return { valid: false, message: 'Pour plusieurs jours, choisissez des horaires fixes ou variables.' };
  }

  if (mode === 'fixed') {
    if (openDays.length === 0) return { valid: false, message: 'Sélectionnez au moins un jour d’ouverture.' };
    if (!hasValidSlots(fixedSlots)) return { valid: false, message: 'Les créneaux fixes sont invalides.' };
    return { valid: true };
  }

  const days = enumerateDateRange(startDate, endDate);
  const enabledDays = days.filter((date) => variableSchedules[date]?.enabled);
  if (enabledDays.length === 0) return { valid: false, message: 'Activez au moins un jour d’ouverture.' };
  for (const date of enabledDays) {
    if (!hasValidSlots(variableSchedules[date]?.slots || [])) {
      return { valid: false, message: `Les créneaux du ${date} sont invalides.` };
    }
  }
  return { valid: true };
};

const mapSlotsForDb = (slots: EventTimeSlot[]) =>
  slots.map((slot) => ({ opens: slot.start, closes: slot.end }));

export const buildOperatingHoursPayload = (params: {
  startDate?: string;
  endDate?: string;
  mode: EventScheduleModeMobile;
  fixedSlots: EventTimeSlot[];
  openDays: number[];
  variableSchedules: VariableSchedules;
}) => {
  const { startDate, endDate, mode, fixedSlots, openDays, variableSchedules } = params;
  if (!startDate || !endDate) return [];

  if (mode === 'single_day') {
    return [
      {
        kind: 'single_day',
        date: toDateOnly(startDate),
        slots: mapSlotsForDb([{ start: new Date(startDate).toTimeString().slice(0, 5), end: new Date(endDate).toTimeString().slice(0, 5) }]),
      },
    ];
  }

  if (mode === 'fixed') {
    return [
      {
        kind: 'fixed',
        open_days: openDays.slice().sort((a, b) => a - b),
        slots: mapSlotsForDb(fixedSlots),
      },
    ];
  }

  const allDays = enumerateDateRange(startDate, endDate);
  return allDays
    .filter((date) => variableSchedules[date]?.enabled)
    .map((date) => ({
      kind: 'day',
      date,
      day_of_week: getIsoDay(date),
      slots: mapSlotsForDb(variableSchedules[date]?.slots || []),
    }));
};

const parseSlot = (slot: any): EventTimeSlot | null => {
  const start = slot?.start || slot?.opens;
  const end = slot?.end || slot?.closes;
  if (!isValidTime(start) || !isValidTime(end)) return null;
  const parsed = { start, end };
  return isValidSlot(parsed) ? parsed : null;
};

const parseSlots = (slots: any): EventTimeSlot[] => {
  if (!Array.isArray(slots)) return [];
  return slots.map(parseSlot).filter((slot): slot is EventTimeSlot => !!slot);
};

const buildVariableDefaults = (startDate?: string, endDate?: string, baseSlot = DEFAULT_SLOT): VariableSchedules => {
  const entries: VariableSchedules = {};
  enumerateDateRange(startDate, endDate).forEach((date) => {
    entries[date] = { enabled: true, slots: [baseSlot] };
  });
  return entries;
};

export const deriveScheduleStateFromEvent = (event: EventScheduleSource | null | undefined) => {
  const startDate = event?.starts_at || undefined;
  const endDate = event?.ends_at || undefined;
  const fallback = {
    mode: isSameDayRange(startDate, endDate) ? ('single_day' as EventScheduleModeMobile) : ('fixed' as EventScheduleModeMobile),
    openDays: WEEK_DAYS,
    fixedSlots: [DEFAULT_SLOT],
    variableSchedules: buildVariableDefaults(startDate, endDate),
  };

  const raw = event?.operating_hours;
  if (!raw) return fallback;

  if (Array.isArray(raw)) {
    const first = raw[0] as any;
    if (first?.kind === 'fixed') {
      const slots = parseSlots(first.slots);
      const openDays = Array.isArray(first.open_days)
        ? first.open_days.filter((d: any) => Number.isInteger(d) && d >= 1 && d <= 7)
        : WEEK_DAYS;
      return {
        mode: 'fixed' as EventScheduleModeMobile,
        openDays: openDays.length ? openDays : WEEK_DAYS,
        fixedSlots: slots.length ? slots : [DEFAULT_SLOT],
        variableSchedules: buildVariableDefaults(startDate, endDate),
      };
    }

    if (first?.kind === 'day' || raw.some((entry: any) => entry?.date && entry?.slots)) {
      const variableSchedules = buildVariableDefaults(startDate, endDate);
      (raw as any[]).forEach((entry) => {
        if (!entry?.date) return;
        const slots = parseSlots(entry.slots);
        if (!variableSchedules[entry.date]) {
          variableSchedules[entry.date] = { enabled: true, slots: slots.length ? slots : [DEFAULT_SLOT] };
          return;
        }
        variableSchedules[entry.date] = {
          enabled: true,
          slots: slots.length ? slots : variableSchedules[entry.date].slots,
        };
      });
      return {
        mode: 'variable' as EventScheduleModeMobile,
        openDays: WEEK_DAYS,
        fixedSlots: [DEFAULT_SLOT],
        variableSchedules,
      };
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    const variableSchedules = buildVariableDefaults(startDate, endDate);
    Object.entries(raw as Record<string, any>).forEach(([date, entry]) => {
      const slot = parseSlot(entry);
      if (!slot) return;
      variableSchedules[date] = { enabled: true, slots: [slot] };
    });
    return {
      mode: 'variable' as EventScheduleModeMobile,
      openDays: WEEK_DAYS,
      fixedSlots: [DEFAULT_SLOT],
      variableSchedules,
    };
  }

  return fallback;
};

export const scheduleDraftFromEvent = (event: EventScheduleSource | null | undefined): EventScheduleDraft => {
  const derived = deriveScheduleStateFromEvent(event);
  return syncScheduleDraft({
    startDate: event?.starts_at || undefined,
    endDate: event?.ends_at || undefined,
    scheduleMode: derived.mode,
    scheduleOpenDays: derived.openDays,
    scheduleFixedSlots: derived.fixedSlots,
    scheduleVariableDays: derived.variableSchedules,
  });
};

export const syncScheduleDraft = (draft: EventScheduleDraft): EventScheduleDraft => {
  const next: EventScheduleDraft = { ...draft };
  if (next.startDate && !next.endDate) {
    const autoEnd = new Date(next.startDate);
    if (!Number.isNaN(autoEnd.getTime())) {
      autoEnd.setHours(autoEnd.getHours() + 2);
      next.endDate = autoEnd.toISOString();
    }
  }
  if (next.startDate && next.endDate) {
    next.scheduleVariableDays = normalizeScheduleByDateRange({
      startDate: next.startDate,
      endDate: next.endDate,
      variableSchedules: next.scheduleVariableDays,
    });
    if (isSameDayRange(next.startDate, next.endDate)) next.scheduleMode = 'single_day';
    else if (next.scheduleMode === 'single_day') next.scheduleMode = 'fixed';
  }
  return next;
};

export const operatingHoursFromDraft = (draft: EventScheduleDraft) =>
  buildOperatingHoursPayload({
    startDate: draft.startDate,
    endDate: draft.endDate,
    mode: draft.scheduleMode,
    fixedSlots: draft.scheduleFixedSlots,
    openDays: draft.scheduleOpenDays,
    variableSchedules: draft.scheduleVariableDays,
  });

const localTimeFromIso = (iso: string | undefined, fallback: string) => {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

/** Prefill the create/suggest planner from a start/end window (poster dates or manual). */
export const scheduleDraftFromDateRange = (startDate?: string, endDate?: string): EventScheduleDraft => {
  let resolvedEnd = endDate;
  if (startDate && resolvedEnd) {
    const start = new Date(startDate);
    const end = new Date(resolvedEnd);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      const bumped = new Date(start);
      bumped.setHours(bumped.getHours() + 2);
      resolvedEnd = bumped.toISOString();
    }
  }

  const startTime = localTimeFromIso(startDate, DEFAULT_EVENT_TIME_SLOT.start);
  const endTime = localTimeFromIso(resolvedEnd, DEFAULT_EVENT_TIME_SLOT.end);
  const slot = { start: startTime, end: endTime };
  const dates = enumerateDateRange(startDate, resolvedEnd);
  const openDays = [...new Set(dates.map(getIsoDay))].sort((a, b) => a - b);

  return syncScheduleDraft({
    startDate,
    endDate: resolvedEnd,
    scheduleMode: isSameDayRange(startDate, resolvedEnd) ? 'single_day' : 'fixed',
    scheduleOpenDays: openDays.length ? openDays : WEEK_DAYS,
    scheduleFixedSlots: isValidSlot(slot) ? [slot] : [{ start: startTime, end: '23:00' }],
    scheduleVariableDays: {},
  });
};

export const normalizeScheduleByDateRange = (params: {
  startDate?: string;
  endDate?: string;
  variableSchedules: VariableSchedules;
}) => {
  const { startDate, endDate, variableSchedules } = params;
  const next: VariableSchedules = {};
  enumerateDateRange(startDate, endDate).forEach((date) => {
    const existing = variableSchedules[date];
    next[date] = existing || { enabled: true, slots: [DEFAULT_SLOT] };
  });
  return next;
};
