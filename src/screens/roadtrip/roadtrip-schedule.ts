import type { RoadtripLeg, RoadtripWaypoint } from './roadtrip.types';

/**
 * Passage time on a leg:
 *   leg departure + leg duration × progression along the geometry.
 * Progression by distance is a fair proxy for driving time on a single leg.
 */
export function passageTimeOnLeg(leg: RoadtripLeg, progression: number): Date {
  const departure = new Date(leg.departureAt).getTime();
  const clamped = Math.max(0, Math.min(1, progression));
  return new Date(departure + leg.durationSeconds * 1000 * clamped);
}

export type PresenceWindow = { startAt: Date; endAt: Date };

/** Margin before/after the estimated passage (parking, walking, flexibility). */
const PASSAGE_MARGIN_MINUTES = 15;

/**
 * Presence window around a passage moment: the user can realistically attend
 * from shortly before passing by until passage + minimum time on site.
 */
export function presenceWindowAroundPassage(
  passageAt: Date,
  minOnSiteMinutes: number,
): PresenceWindow {
  const startAt = new Date(passageAt.getTime() - PASSAGE_MARGIN_MINUTES * 60_000);
  const endAt = new Date(
    passageAt.getTime() + (minOnSiteMinutes + PASSAGE_MARGIN_MINUTES) * 60_000,
  );
  return { startAt, endAt };
}

/** Presence window at a stop = the arrival→departure period the user declared. */
export function presenceWindowAtStop(waypoint: RoadtripWaypoint): PresenceWindow | null {
  if (!waypoint.arrivalAt || !waypoint.departureAt) return null;
  const startAt = new Date(waypoint.arrivalAt);
  const endAt = new Date(waypoint.departureAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return null;
  }
  return { startAt, endAt };
}

/**
 * Temporal compatibility:
 *   event start ≤ presence end AND event end ≥ presence start.
 */
export function eventOverlapsWindow(
  eventStartsAt: string,
  eventEndsAt: string,
  window: PresenceWindow,
): boolean {
  const start = new Date(eventStartsAt).getTime();
  const end = new Date(eventEndsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= window.endAt.getTime() && end >= window.startAt.getTime();
}

/** Overlap duration in minutes between an event and a presence window. */
export function overlapMinutes(
  eventStartsAt: string,
  eventEndsAt: string,
  window: PresenceWindow,
): number {
  const start = Math.max(new Date(eventStartsAt).getTime(), window.startAt.getTime());
  const end = Math.min(new Date(eventEndsAt).getTime(), window.endAt.getTime());
  return Math.max(0, Math.round((end - start) / 60_000));
}

export type MapboxLegSummary = {
  durationSeconds: number;
  distanceMeters: number;
  geometry: [number, number][];
};

/**
 * Attach departure times to raw Directions legs.
 *
 * Leg N departs when the previous leg arrives, extended by the dwell time the
 * user declared at the intermediate stop (departureAt wins when provided and
 * later than the computed arrival).
 */
export function buildScheduledLegs(params: {
  waypoints: RoadtripWaypoint[];
  mapboxLegs: MapboxLegSummary[];
  departureAt: string;
}): RoadtripLeg[] {
  const { waypoints, mapboxLegs, departureAt } = params;
  const legs: RoadtripLeg[] = [];
  let cursor = new Date(departureAt);

  for (let i = 0; i < mapboxLegs.length; i += 1) {
    const raw = mapboxLegs[i];
    legs.push({
      index: i,
      geometry: raw.geometry,
      departureAt: cursor.toISOString(),
      durationSeconds: raw.durationSeconds,
      distanceMeters: raw.distanceMeters,
    });

    const arrival = new Date(cursor.getTime() + raw.durationSeconds * 1000);
    const nextWaypoint = waypoints[i + 1];
    const declaredDeparture = nextWaypoint?.departureAt ? new Date(nextWaypoint.departureAt) : null;
    cursor =
      declaredDeparture && declaredDeparture.getTime() > arrival.getTime()
        ? declaredDeparture
        : arrival;
  }

  return legs;
}
