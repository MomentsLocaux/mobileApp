import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '@/types/database';
import {
  detectArrivalShiftConflict,
  insertCandidateAsWaypoint,
  removeEventFromWaypoints,
} from './roadtrip-program';
import type { RoadtripCandidate, RoadtripWaypoint } from './roadtrip.types';

const waypoints: RoadtripWaypoint[] = [
  { kind: 'origin', label: 'Paris', coordinate: { latitude: 48.85, longitude: 2.35 } },
  { kind: 'destination', label: 'Caen', coordinate: { latitude: 49.18, longitude: -0.37 } },
];

function candidate(overrides: Partial<RoadtripCandidate> = {}): RoadtripCandidate {
  return {
    event: {
      id: 'evt-1',
      title: 'Marché de nuit',
      latitude: 49.0,
      longitude: 1.0,
      starts_at: '2026-08-08T10:00:00.000Z',
      ends_at: '2026-08-08T12:00:00.000Z',
    } as EventWithCreator,
    origin: { kind: 'leg', legIndex: 0 },
    progression: 0.5,
    distanceToRouteKm: 2,
    estimatedDetourMinutes: 8,
    passageAt: '2026-08-08T10:30:00.000Z',
    presenceStartAt: '2026-08-08T10:15:00.000Z',
    presenceEndAt: '2026-08-08T12:15:00.000Z',
    approximateTime: false,
    score: 0.8,
    ...overrides,
  };
}

test('inserting a candidate creates an event waypoint on the matched leg', () => {
  const result = insertCandidateAsWaypoint({
    waypoints,
    candidate: candidate(),
    minOnSiteMinutes: 90,
  });
  assert.ok(!('error' in result));
  assert.equal(result.waypoints.length, 3);
  assert.equal(result.waypoints[1].kind, 'event');
  assert.equal(result.waypoints[1].eventId, 'evt-1');
  assert.equal(result.planned.plannedDurationMinutes, 90);
  assert.equal(result.planned.departureAt, '2026-08-08T12:00:00.000Z');
});

test('duplicate event and stop cap are rejected', () => {
  const first = insertCandidateAsWaypoint({
    waypoints,
    candidate: candidate(),
    minOnSiteMinutes: 45,
  });
  assert.ok(!('error' in first));
  const dup = insertCandidateAsWaypoint({
    waypoints: first.waypoints,
    candidate: candidate(),
    minOnSiteMinutes: 45,
  });
  assert.ok('error' in dup);

  let crowded = waypoints;
  for (let i = 0; i < 8; i += 1) {
    const next = insertCandidateAsWaypoint({
      waypoints: crowded,
      candidate: candidate({
        event: { ...candidate().event, id: `evt-${i}`, title: `E${i}` } as EventWithCreator,
      }),
      minOnSiteMinutes: 45,
    });
    assert.ok(!('error' in next));
    crowded = next.waypoints;
  }
  const overflow = insertCandidateAsWaypoint({
    waypoints: crowded,
    candidate: candidate({
      event: { ...candidate().event, id: 'evt-x', title: 'X' } as EventWithCreator,
    }),
    minOnSiteMinutes: 45,
  });
  assert.ok('error' in overflow);
});

test('arrival shift above threshold is a conflict, small shifts are ignored', () => {
  const conflict = detectArrivalShiftConflict({
    previousDestinationArrivalAt: '2026-08-08T14:00:00.000Z',
    nextDestinationArrivalAt: '2026-08-08T14:45:00.000Z',
  });
  assert.ok(conflict);
  assert.equal(conflict.kind, 'arrival_shift');
  assert.equal(conflict.shiftMinutes, 45);

  assert.equal(
    detectArrivalShiftConflict({
      previousDestinationArrivalAt: '2026-08-08T14:00:00.000Z',
      nextDestinationArrivalAt: '2026-08-08T14:10:00.000Z',
    }),
    null,
  );
});

test('removeEventFromWaypoints leaves favorites concept untouched and drops the stop', () => {
  const inserted = insertCandidateAsWaypoint({
    waypoints,
    candidate: candidate(),
    minOnSiteMinutes: 90,
  });
  assert.ok(!('error' in inserted));
  const cleaned = removeEventFromWaypoints(inserted.waypoints, 'evt-1');
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned.some((w) => w.eventId === 'evt-1'), false);
});
