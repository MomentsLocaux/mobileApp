import { fetchDrivingRoute } from '@/services/roadtrip/mapbox-directions.service';
import { buildScheduledLegs } from './roadtrip-schedule';
import type { RoadtripRoute, RoadtripWaypoint } from './roadtrip.types';

const DEFAULT_STOP_DWELL_MINUTES = 120;
const DEFAULT_DESTINATION_STAY_MINUTES = 180;

/**
 * Recalculate Directions + scheduled presence windows for a waypoint list.
 * Event waypoints keep their declared arrival/departure when already set;
 * city stops get a default dwell if missing.
 */
export async function rebuildRouteFromWaypoints(params: {
  waypoints: RoadtripWaypoint[];
  departureAt: string;
}): Promise<{ route: RoadtripRoute; waypoints: RoadtripWaypoint[] }> {
  const { waypoints, departureAt } = params;
  if (waypoints.length < 2) throw new Error('roadtrip: at least origin and destination required');

  const directions = await fetchDrivingRoute(waypoints.map((w) => w.coordinate));
  const provisionalLegs = buildScheduledLegs({
    waypoints,
    mapboxLegs: directions.legs,
    departureAt,
  });

  const withWindows = waypoints.map((waypoint, index): RoadtripWaypoint => {
    if (waypoint.kind === 'origin') return waypoint;
    const inboundLeg = provisionalLegs[index - 1];
    if (!inboundLeg) return waypoint;
    const computedArrival = new Date(
      new Date(inboundLeg.departureAt).getTime() + inboundLeg.durationSeconds * 1000,
    );
    const arrivalAt = waypoint.arrivalAt ?? computedArrival.toISOString();
    let departureAtIso = waypoint.departureAt ?? null;
    if (!departureAtIso) {
      const stay =
        waypoint.kind === 'destination'
          ? DEFAULT_DESTINATION_STAY_MINUTES
          : DEFAULT_STOP_DWELL_MINUTES;
      departureAtIso = new Date(new Date(arrivalAt).getTime() + stay * 60_000).toISOString();
    }
    // If the drive arrives later than the previously declared arrival, shift the window.
    if (computedArrival.getTime() > new Date(arrivalAt).getTime()) {
      const dwellMs = new Date(departureAtIso).getTime() - new Date(arrivalAt).getTime();
      const shiftedArrival = computedArrival.toISOString();
      return {
        ...waypoint,
        arrivalAt: shiftedArrival,
        departureAt: new Date(computedArrival.getTime() + Math.max(dwellMs, 0)).toISOString(),
      };
    }
    return { ...waypoint, arrivalAt, departureAt: departureAtIso };
  });

  const legs = buildScheduledLegs({
    waypoints: withWindows,
    mapboxLegs: directions.legs,
    departureAt,
  });

  return {
    route: {
      legs,
      totalDurationSeconds: directions.totalDurationSeconds,
      totalDistanceMeters: directions.totalDistanceMeters,
    },
    waypoints: withWindows,
  };
}
