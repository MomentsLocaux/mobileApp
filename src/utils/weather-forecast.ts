/** Forecast window and Open-Meteo parsing for an event. No network. */

export const EVENT_WEATHER_TIMEZONE = 'Europe/Paris';
export const FORECAST_HORIZON_DAYS = 16;
/** Columns shown on the event page, as in the three-day strip. */
export const WEATHER_STRIP_DAYS = 3;

export type WeatherKind =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder'
  | 'unknown';

export type EventWeatherDay = {
  date: string;
  label: string;
  /** Three-letter French weekday, e.g. VEN. */
  weekday: string;
  /** Calendar day without a leading zero, e.g. 9. */
  dayNumber: string;
  tempMin: number | null;
  tempMax: number | null;
  precipitationProbability: number | null;
  summary: string;
  kind: WeatherKind;
};

export type EventWeatherView =
  | { status: 'past'; message: string }
  | { status: 'too_far'; message: string }
  | { status: 'unavailable'; message: string }
  | {
      status: 'ready';
      headline: string;
      caption: string;
      days: EventWeatherDay[];
      attribution: string;
    };

export type WeatherFetchPlan =
  | { status: 'past' }
  | { status: 'too_far'; availableOn: string }
  | { status: 'fetch'; startDate: string; endDate: string; truncated: boolean };

const WEATHER_SUMMARY: Record<WeatherKind, string> = {
  clear: 'Ciel dégagé',
  cloudy: 'Nuageux',
  fog: 'Brouillard',
  drizzle: 'Bruine',
  rain: 'Pluie',
  snow: 'Neige',
  thunder: 'Orages',
  unknown: 'Conditions variables',
};

export const WEATHER_ATTRIBUTION = 'Données météo : Open-Meteo';

type DailyPayload = {
  time?: unknown;
  weather_code?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_probability_max?: unknown;
};

type HourlyPayload = {
  time?: unknown;
  temperature_2m?: unknown;
  precipitation_probability?: unknown;
  weather_code?: unknown;
};

export function weatherKindFromCode(code: number | null): WeatherKind {
  if (code == null || Number.isNaN(code)) return 'unknown';
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return 'unknown';
}

export function weatherSummary(kind: WeatherKind): string {
  return WEATHER_SUMMARY[kind];
}

export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function hourKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:00`;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function weatherDayParts(dateKey: string): { weekday: string; dayNumber: string; label: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  const weekdayRaw = utc.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
  const weekday = weekdayRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase();
  const label = utc.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return {
    weekday,
    dayNumber: String(day),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

function formatAvailableOn(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return utc.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function asNumbers(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [];
  return value.map(asNumber);
}

export function planEventWeather(input: {
  startsAt: string;
  endsAt?: string | null;
  now?: Date;
  timeZone?: string;
}): WeatherFetchPlan {
  const timeZone = input.timeZone ?? EVENT_WEATHER_TIMEZONE;
  const startInstant = new Date(input.startsAt);
  const endInstant = new Date(input.endsAt || input.startsAt);
  if (Number.isNaN(startInstant.getTime()) || Number.isNaN(endInstant.getTime())) {
    return { status: 'past' };
  }

  const now = input.now ?? new Date();
  const today = calendarDateInTimeZone(now, timeZone);
  const startDate = calendarDateInTimeZone(startInstant, timeZone);
  const endDate = calendarDateInTimeZone(
    endInstant.getTime() < startInstant.getTime() ? startInstant : endInstant,
    timeZone,
  );
  const horizon = addDays(today, FORECAST_HORIZON_DAYS - 1);

  if (endDate < today) return { status: 'past' };
  if (startDate > horizon) {
    return { status: 'too_far', availableOn: addDays(startDate, -(FORECAST_HORIZON_DAYS - 1)) };
  }

  const fetchStart = startDate < today ? today : startDate;
  const windowEnd = addDays(fetchStart, WEATHER_STRIP_DAYS - 1);
  const fetchEnd = windowEnd > horizon ? horizon : windowEnd;
  return {
    status: 'fetch',
    startDate: fetchStart,
    endDate: fetchEnd,
    truncated: endDate > fetchEnd,
  };
}

export function openMeteoForecastUrl(input: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  timeZone?: string;
}): string {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    timezone: input.timeZone ?? EVENT_WEATHER_TIMEZONE,
    start_date: input.startDate,
    end_date: input.endDate,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function messageForWeatherPlan(plan: Exclude<WeatherFetchPlan, { status: 'fetch' }>): string {
  if (plan.status === 'past') {
    return 'Ce moment est passé. La prévision ne s’affiche plus.';
  }
  return `La prévision sera disponible à partir du ${formatAvailableOn(plan.availableOn)}, dans les ${FORECAST_HORIZON_DAYS} jours qui précèdent.`;
}

function rainLabel(probability: number | null): string | null {
  if (probability == null) return null;
  const value = Math.round(probability);
  if (value < 20) return `Peu de pluie (${value} %)`;
  if (value < 60) return `Risque de pluie (${value} %)`;
  return `Pluie probable (${value} %)`;
}

function rangeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && Math.round(min) !== Math.round(max)) {
    return `${Math.round(min)}° à ${Math.round(max)}°`;
  }
  const value = max ?? min;
  return value == null ? null : `${Math.round(value)}°`;
}

export function parseOpenMeteoForecast(input: {
  payload: unknown;
  startsAt: string;
  truncated: boolean;
  timeZone?: string;
}): EventWeatherView {
  const timeZone = input.timeZone ?? EVENT_WEATHER_TIMEZONE;
  const root = input.payload && typeof input.payload === 'object'
    ? (input.payload as { daily?: DailyPayload; hourly?: HourlyPayload })
    : null;
  const daily = root?.daily;
  const times = Array.isArray(daily?.time) ? daily.time.filter((item): item is string => typeof item === 'string') : [];
  if (!daily || times.length === 0) {
    return { status: 'unavailable', message: 'Prévision indisponible pour ce lieu.' };
  }

  const codes = asNumbers(daily.weather_code);
  const maxes = asNumbers(daily.temperature_2m_max);
  const mins = asNumbers(daily.temperature_2m_min);
  const rains = asNumbers(daily.precipitation_probability_max);

  const hiddenDayCount = Math.max(0, times.length - WEATHER_STRIP_DAYS);
  const days: EventWeatherDay[] = times.slice(0, WEATHER_STRIP_DAYS).map((date, index) => {
    const kind = weatherKindFromCode(codes[index] ?? null);
    const parts = weatherDayParts(date);
    return {
      date,
      label: parts.label,
      weekday: parts.weekday,
      dayNumber: parts.dayNumber,
      tempMin: mins[index] ?? null,
      tempMax: maxes[index] ?? null,
      precipitationProbability: rains[index] ?? null,
      summary: weatherSummary(kind),
      kind,
    };
  });

  const first = days[0];
  const hourly = matchHourly(root?.hourly, input.startsAt, timeZone);
  const hourTemp = hourly?.temperature ?? first.tempMax;
  const hourKind = hourly ? weatherKindFromCode(hourly.code) : first.kind;
  const rain = rainLabel(hourly?.precipitation ?? first.precipitationProbability);
  const dailyRange = rangeLabel(first.tempMin, first.tempMax);

  const headlineParts = [
    hourTemp == null ? null : `${Math.round(hourTemp)}°`,
    weatherSummary(hourKind),
  ].filter(Boolean);
  const captionParts = [
    days.length === 1 && hourly && dailyRange ? `Sur la journée : ${dailyRange}` : null,
    rain,
    input.truncated ? 'La fin du moment dépasse l’horizon de prévision.' : null,
    hiddenDayCount > 0 ? 'Seuls les 3 premiers jours sont affichés.' : null,
  ].filter(Boolean);

  return {
    status: 'ready',
    headline: headlineParts.join(' · '),
    caption: captionParts.join(' · '),
    days,
    attribution: WEATHER_ATTRIBUTION,
  };
}

function matchHourly(
  hourly: HourlyPayload | undefined,
  startsAt: string,
  timeZone: string,
): { temperature: number | null; precipitation: number | null; code: number | null } | null {
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const target = hourKeyInTimeZone(new Date(startsAt), timeZone);
  const index = hourly.time.findIndex((value) => value === target);
  if (index < 0) return null;
  const temps = asNumbers(hourly.temperature_2m);
  const rains = asNumbers(hourly.precipitation_probability);
  const codes = asNumbers(hourly.weather_code);
  return {
    temperature: temps[index] ?? null,
    precipitation: rains[index] ?? null,
    code: codes[index] ?? null,
  };
}
