type EventLike = {
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  venue_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
};

export type EventCardDateStyle = 'compact' | 'long';

export type EventCardSchedule = {
  start: string;
  end: string;
  city: string;
};

const capitalizeFirst = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (date: Date, style: EventCardDateStyle): string => {
  const timePart = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (style === 'compact') {
    const datePart = date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${capitalizeFirst(datePart)} · ${timePart}`;
  }

  const datePart = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${capitalizeFirst(datePart)} · ${timePart}`;
};

export function getEventCardCity(event: EventLike): string {
  const city = typeof event.city === 'string' ? event.city.trim() : '';
  if (city) return city;

  const venue = typeof event.venue_name === 'string' ? event.venue_name.trim() : '';
  if (venue) return venue;

  const address = typeof event.address === 'string' ? event.address.trim() : '';
  if (address) return address;

  return 'Ville à confirmer';
}

export function getEventCardSchedule(
  event: EventLike,
  style: EventCardDateStyle = 'compact'
): EventCardSchedule {
  const startDate = parseDate(event.starts_at);
  const endDate = parseDate(event.ends_at);

  let start: string;
  if (startDate) {
    start = formatDateTime(startDate, style);
  } else if (endDate) {
    start = 'Début non précisé';
  } else {
    start = 'Date à confirmer';
  }

  let end: string;
  if (endDate) {
    if (startDate && endDate.getTime() < startDate.getTime()) {
      end = 'Fin non précisée';
    } else {
      end = formatDateTime(endDate, style);
    }
  } else if (startDate) {
    end = 'Fin non précisée';
  } else {
    end = 'Fin non précisée';
  }

  return {
    start,
    end,
    city: getEventCardCity(event),
  };
}

export const formatEventCardStartLine = (schedule: EventCardSchedule) => `Début · ${schedule.start}`;
export const formatEventCardEndLine = (schedule: EventCardSchedule) => `Fin · ${schedule.end}`;
