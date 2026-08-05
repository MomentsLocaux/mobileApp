import type { EventWithCreator } from '@/types/database';
import {
  corridorHalfWidthKm,
  estimateDetourMinutes,
  haversineKm,
  nearestPointOnPolyline,
} from './roadtrip-geo';
import {
  eventOverlapsWindow,
  overlapMinutes,
  passageTimeOnLeg,
  presenceWindowAroundPassage,
  presenceWindowAtStop,
} from './roadtrip-schedule';
import type {
  RoadtripCandidate,
  RoadtripLeg,
  RoadtripPreferences,
  RoadtripWaypoint,
} from './roadtrip.types';
import { ROADTRIP_CANDIDATE_LIMIT } from './roadtrip.types';

const STOP_RADIUS_KM = 5;

function isEligible(event: EventWithCreator, preferences: RoadtripPreferences): boolean {
  if (event.status !== 'published') return false;
  if (event.visibility !== 'public') return false;
  if (typeof event.latitude !== 'number' || typeof event.longitude !== 'number') return false;
  if (!event.starts_at || !event.ends_at) return false;
  if (preferences.freeOnly && !event.is_free) return false;
  if (
    preferences.categoryValues.length > 0 &&
    (!event.category || !preferences.categoryValues.includes(event.category))
  ) {
    return false;
  }
  return true;
}

function qualityScore(event: EventWithCreator): number {
  let score = 0;
  if (event.cover_url) score += 0.25;
  if ((event.description ?? '').length >= 80) score += 0.25;
  if (event.venue_name || event.address) score += 0.25;
  if (event.category) score += 0.25;
  return score;
}

function categoryScore(event: EventWithCreator, preferences: RoadtripPreferences): number {
  if (preferences.categoryValues.length === 0) return event.category ? 1 : 0.5;
  return event.category && preferences.categoryValues.includes(event.category) ? 1 : 0;
}

/**
 * Deterministic ranking — no ML:
 * 40% temporal fit, 30% detour, 20% categories, 10% event quality.
 */
function scoreCandidate(params: {
  event: EventWithCreator;
  preferences: RoadtripPreferences;
  overlapMin: number;
  detourMinutes: number;
}): number {
  const { event, preferences, overlapMin, detourMinutes } = params;
  const timeScore = Math.min(1, overlapMin / preferences.minOnSiteMinutes);
  const detourScore = Math.max(0, 1 - detourMinutes / preferences.detourBudgetMinutes);
  return (
    0.4 * timeScore +
    0.3 * detourScore +
    0.2 * categoryScore(event, preferences) +
    0.1 * qualityScore(event)
  );
}

function matchOnLegs(
  event: EventWithCreator,
  legs: RoadtripLeg[],
  preferences: RoadtripPreferences,
): RoadtripCandidate | null {
  const corridorKm = corridorHalfWidthKm(preferences.detourBudgetMinutes);
  const point = { latitude: event.latitude, longitude: event.longitude };

  let best: RoadtripCandidate | null = null;
  for (const leg of legs) {
    const nearest = nearestPointOnPolyline(point, leg.geometry);
    if (!nearest || nearest.distanceKm > corridorKm) continue;

    const detourMinutes = estimateDetourMinutes(nearest.distanceKm);
    if (detourMinutes > preferences.detourBudgetMinutes) continue;

    const passageAt = passageTimeOnLeg(leg, nearest.progression);
    const window = presenceWindowAroundPassage(passageAt, preferences.minOnSiteMinutes);
    if (!eventOverlapsWindow(event.starts_at, event.ends_at, window)) continue;
    // Already over by the time the user drives past.
    if (new Date(event.ends_at).getTime() < passageAt.getTime()) continue;

    const overlapMin = overlapMinutes(event.starts_at, event.ends_at, window);
    const candidate: RoadtripCandidate = {
      event,
      origin: { kind: 'leg', legIndex: leg.index },
      progression: nearest.progression,
      distanceToRouteKm: nearest.distanceKm,
      estimatedDetourMinutes: detourMinutes,
      passageAt: passageAt.toISOString(),
      presenceStartAt: window.startAt.toISOString(),
      presenceEndAt: window.endAt.toISOString(),
      approximateTime: !preferences.timeConfirmed,
      score: scoreCandidate({ event, preferences, overlapMin, detourMinutes }),
    };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function matchOnStops(
  event: EventWithCreator,
  waypoints: RoadtripWaypoint[],
  preferences: RoadtripPreferences,
): RoadtripCandidate | null {
  const point = { latitude: event.latitude, longitude: event.longitude };

  let best: RoadtripCandidate | null = null;
  for (const waypoint of waypoints) {
    if (waypoint.kind === 'origin') continue;
    const window = presenceWindowAtStop(waypoint);
    if (!window) continue;

    const distanceKm = haversineKm(point, waypoint.coordinate);
    if (distanceKm > STOP_RADIUS_KM) continue;
    if (!eventOverlapsWindow(event.starts_at, event.ends_at, window)) continue;

    const overlapMin = overlapMinutes(event.starts_at, event.ends_at, window);
    const detourMinutes = estimateDetourMinutes(distanceKm);
    const candidate: RoadtripCandidate = {
      event,
      origin: { kind: 'stop', stopLabel: waypoint.label, distanceKm },
      progression: 0,
      distanceToRouteKm: distanceKm,
      estimatedDetourMinutes: detourMinutes,
      passageAt: window.startAt.toISOString(),
      presenceStartAt: window.startAt.toISOString(),
      presenceEndAt: window.endAt.toISOString(),
      approximateTime: !preferences.timeConfirmed,
      score: scoreCandidate({ event, preferences, overlapMin, detourMinutes }),
    };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

/**
 * Pure candidate engine for the spike. The same rules are meant to move
 * server-side later as a `list_roadtrip_event_candidates` PostGIS RPC; keeping
 * this module free of I/O makes the two implementations testable against the
 * same fixtures.
 */
export function computeRoadtripCandidates(params: {
  events: EventWithCreator[];
  legs: RoadtripLeg[];
  waypoints: RoadtripWaypoint[];
  preferences: RoadtripPreferences;
  limit?: number;
}): RoadtripCandidate[] {
  const { events, legs, waypoints, preferences, limit = ROADTRIP_CANDIDATE_LIMIT } = params;

  const candidates: RoadtripCandidate[] = [];
  for (const event of events) {
    if (!isEligible(event, preferences)) continue;

    const legMatch =
      preferences.searchZone !== 'stops' ? matchOnLegs(event, legs, preferences) : null;
    const stopMatch =
      preferences.searchZone !== 'route' ? matchOnStops(event, waypoints, preferences) : null;

    const best =
      legMatch && stopMatch
        ? legMatch.score >= stopMatch.score
          ? legMatch
          : stopMatch
        : (legMatch ?? stopMatch);
    if (best) candidates.push(best);
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
    .slice(0, limit);
}
