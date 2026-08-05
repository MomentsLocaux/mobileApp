import type { RoadtripCandidate, RoadtripWaypoint } from './roadtrip.types';
import { ROADTRIP_MAX_STOPS } from './roadtrip.types';

export type PlannedEventStop = {
  eventId: string;
  label: string;
  latitude: number;
  longitude: number;
  /** Estimated arrival at the event (ISO). */
  arrivalAt: string;
  /** Departure after the minimum on-site time (ISO). */
  departureAt: string;
  legIndex: number;
  estimatedDetourMinutes: number;
  plannedDurationMinutes: number;
};

export type ScheduleConflict = {
  kind: 'arrival_shift' | 'lost_overlap' | 'too_many_stops';
  message: string;
  eventId?: string;
  /** Absolute shift of destination arrival, in minutes. */
  shiftMinutes?: number;
};

/**
 * Insert a selected candidate into the itinerary as an `event` waypoint.
 * For a leg match: inserted between the two ends of that leg.
 * For a stop match: inserted just before that stop (local visit).
 */
export function insertCandidateAsWaypoint(params: {
  waypoints: RoadtripWaypoint[];
  candidate: RoadtripCandidate;
  minOnSiteMinutes: number;
}): { waypoints: RoadtripWaypoint[]; planned: PlannedEventStop } | { error: string } {
  const { waypoints, candidate, minOnSiteMinutes } = params;
  const intermediateCount = waypoints.filter((w) => w.kind === 'stop' || w.kind === 'event').length;
  if (intermediateCount >= ROADTRIP_MAX_STOPS) {
    return { error: `Maximum ${ROADTRIP_MAX_STOPS} étapes atteint.` };
  }
  if (waypoints.some((w) => w.eventId === candidate.event.id)) {
    return { error: 'Cet événement est déjà dans le programme.' };
  }

  const arrivalAt = candidate.passageAt;
  const departureAt = new Date(
    new Date(arrivalAt).getTime() + minOnSiteMinutes * 60_000,
  ).toISOString();
  const eventWaypoint: RoadtripWaypoint = {
    kind: 'event',
    label: candidate.event.title,
    coordinate: {
      latitude: candidate.event.latitude,
      longitude: candidate.event.longitude,
    },
    arrivalAt,
    departureAt,
    eventId: candidate.event.id,
  };

  let insertAt: number;
  const origin = candidate.origin;
  if (origin.kind === 'leg') {
    // After the waypoint that starts this leg.
    insertAt = origin.legIndex + 1;
  } else {
    const stopIndex = waypoints.findIndex(
      (w) => w.kind !== 'origin' && w.label === origin.stopLabel,
    );
    insertAt = stopIndex >= 0 ? stopIndex : waypoints.length - 1;
  }

  const next = [...waypoints.slice(0, insertAt), eventWaypoint, ...waypoints.slice(insertAt)];
  const planned: PlannedEventStop = {
    eventId: candidate.event.id,
    label: candidate.event.title,
    latitude: candidate.event.latitude,
    longitude: candidate.event.longitude,
    arrivalAt,
    departureAt,
    legIndex: origin.kind === 'leg' ? origin.legIndex : Math.max(0, insertAt - 1),
    estimatedDetourMinutes: candidate.estimatedDetourMinutes,
    plannedDurationMinutes: minOnSiteMinutes,
  };
  return { waypoints: next, planned };
}

/**
 * Compare a previous destination arrival with the one after a route recalculation.
 * A shift above `thresholdMinutes` is a conflict that needs confirmation.
 */
export function detectArrivalShiftConflict(params: {
  previousDestinationArrivalAt: string | null | undefined;
  nextDestinationArrivalAt: string | null | undefined;
  thresholdMinutes?: number;
}): ScheduleConflict | null {
  const { previousDestinationArrivalAt, nextDestinationArrivalAt, thresholdMinutes = 20 } = params;
  if (!previousDestinationArrivalAt || !nextDestinationArrivalAt) return null;
  const prev = new Date(previousDestinationArrivalAt).getTime();
  const next = new Date(nextDestinationArrivalAt).getTime();
  if (Number.isNaN(prev) || Number.isNaN(next)) return null;
  const shiftMinutes = Math.round((next - prev) / 60_000);
  if (Math.abs(shiftMinutes) < thresholdMinutes) return null;
  const direction = shiftMinutes > 0 ? 'plus tard' : 'plus tôt';
  return {
    kind: 'arrival_shift',
    message: `L'arrivée à destination serait décalée de ${Math.abs(shiftMinutes)} min (${direction}).`,
    shiftMinutes,
  };
}

/** Waypoints that represent events already in the program. */
export function plannedEventWaypoints(waypoints: RoadtripWaypoint[]): RoadtripWaypoint[] {
  return waypoints.filter((w) => w.kind === 'event' && w.eventId);
}

/** Remove an event from the program (does not touch favorites). */
export function removeEventFromWaypoints(
  waypoints: RoadtripWaypoint[],
  eventId: string,
): RoadtripWaypoint[] {
  return waypoints.filter((w) => w.eventId !== eventId);
}
