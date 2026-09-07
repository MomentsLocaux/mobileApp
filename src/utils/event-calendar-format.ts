import { getEventShareUrl } from './event-share';

export type CalendarEventInput = {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  locationLabel?: string | null;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function formatCalendarLocalStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function resolveCalendarDates(
  startsAt: string,
  endsAt?: string | null,
): { start: Date; end: Date } | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = endsAt ? new Date(endsAt) : start;
  const end =
    Number.isNaN(endRaw.getTime()) || endRaw <= start
      ? new Date(start.getTime() + 60 * 60 * 1000)
      : endRaw;
  return { start, end };
}

export function buildCalendarNotes(input: CalendarEventInput): string {
  const shareUrl = getEventShareUrl(input.id);
  const description = input.description?.trim().slice(0, 1500) || '';
  return [description, shareUrl].filter(Boolean).join('\n\n');
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const dates = resolveCalendarDates(input.startsAt, input.endsAt);
  if (!dates) return '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  return (
    'https://www.google.com/calendar/render' +
    `?action=TEMPLATE&text=${encodeURIComponent(input.title || 'Événement')}` +
    `&dates=${encodeURIComponent(`${formatCalendarLocalStamp(dates.start)}/${formatCalendarLocalStamp(dates.end)}`)}` +
    `&details=${encodeURIComponent(buildCalendarNotes(input))}` +
    `&location=${encodeURIComponent(input.locationLabel || '')}` +
    `&ctz=${encodeURIComponent(timezone)}`
  );
}
