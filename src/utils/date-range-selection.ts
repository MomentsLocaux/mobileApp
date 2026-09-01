import type { DateRangeMode, DateRangeValue } from '@/types/eventDate.model';

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})/;

export function toDateOnlyString(date: Date | string = new Date()): string {
  if (typeof date === 'string') {
    const match = DATE_ONLY.exec(date)?.[1];
    if (match) return match;
  }
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

export function closeOpenDateRange(range: DateRangeValue): DateRangeValue {
  if (range.startDate && !range.endDate) {
    return { startDate: range.startDate, endDate: range.startDate };
  }
  if (range.endDate && !range.startDate) {
    return { startDate: range.endDate, endDate: range.endDate };
  }
  return range;
}

export function formatDateOnlyFr(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match?.[3] && match[2]) return `${match[3]}/${match[2]}`;
  return value;
}

export function formatRangeSelectionLabel(range: DateRangeValue): string | null {
  const start = range.startDate || range.endDate;
  if (!start) return null;
  const end = range.endDate || range.startDate;
  if (end && end !== start) {
    return `${formatDateOnlyFr(start)}–${formatDateOnlyFr(end)}`;
  }
  return formatDateOnlyFr(start);
}

export function isSingleDayRange(range: DateRangeValue): boolean {
  return Boolean(range.startDate && (!range.endDate || range.endDate === range.startDate));
}

/**
 * Range-mode search calendar:
 * - first tap selects that day
 * - second tap on another day completes a period (order-independent)
 * - second tap on the same day keeps the single day
 * - tap after a multi-day period starts over
 */
export function nextDateRangeOnDayPress(
  mode: DateRangeMode,
  range: DateRangeValue,
  dateString: string
): DateRangeValue {
  const date = toDateOnlyString(dateString);
  if (!date) return range;

  if (mode === 'single') {
    return { startDate: date, endDate: null };
  }

  const startDate = range.startDate ? toDateOnlyString(range.startDate) : null;
  const awaitingSecondDay = Boolean(
    startDate && (!range.endDate || range.endDate === startDate)
  );

  if (!awaitingSecondDay || !startDate) {
    return { startDate: date, endDate: null };
  }

  if (date === startDate) {
    return { startDate: date, endDate: null };
  }

  return date < startDate
    ? { startDate: date, endDate: startDate }
    : { startDate, endDate: date };
}
