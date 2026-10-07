/** Local reminder the day after install. Tap opens notification settings. */
export const SETTINGS_TOUR_ID = 'settings-tour-j1';

export const SETTINGS_TOUR_COPY = {
  title: 'Une minute pour ne rien rater',
  body: 'Viens personnaliser ton expérience Moments Locaux.',
} as const;

/** 10:00 on the device clock, the morning after the first open. */
export const SETTINGS_TOUR_HOUR = 10;

/** How long after the missed 10:00 we may still send one catch-up. */
export const SETTINGS_TOUR_GRACE_MS = 36 * 60 * 60 * 1000;

const CATCH_UP_DELAY_MS = 60_000;

const atHour = (from: Date, hour: number): Date => {
  const next = new Date(from);
  if (from.getHours() >= hour) next.setDate(next.getDate() + 1);
  next.setHours(hour, 0, 0, 0);
  return next;
};

/**
 * 10:00 local time on the calendar day after `firstOpenAt`.
 * If that moment already passed, one catch-up stays inside daytime hours
 * and inside the grace window. After that, nothing is sent.
 */
export function settingsTourFireAt(firstOpenAt: Date, now: Date): Date | null {
  if (Number.isNaN(firstOpenAt.getTime()) || Number.isNaN(now.getTime())) return null;

  const target = new Date(firstOpenAt);
  target.setDate(target.getDate() + 1);
  target.setHours(SETTINGS_TOUR_HOUR, 0, 0, 0);

  if (target.getTime() > now.getTime()) return target;
  if (now.getTime() - target.getTime() > SETTINGS_TOUR_GRACE_MS) return null;

  const hour = now.getHours();
  if (hour >= 8 && hour < 21) {
    return new Date(now.getTime() + CATCH_UP_DELAY_MS);
  }

  const morning = atHour(now, SETTINGS_TOUR_HOUR);
  if (morning.getTime() - target.getTime() > SETTINGS_TOUR_GRACE_MS) return null;
  return morning;
}
