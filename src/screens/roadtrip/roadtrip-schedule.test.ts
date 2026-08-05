import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScheduledLegs,
  eventOverlapsWindow,
  overlapMinutes,
  passageTimeOnLeg,
  presenceWindowAroundPassage,
  presenceWindowAtStop,
} from './roadtrip-schedule';
import type { RoadtripLeg, RoadtripWaypoint } from './roadtrip.types';

const leg: RoadtripLeg = {
  index: 0,
  geometry: [
    [2.35, 48.85],
    [4.03, 49.25],
  ],
  departureAt: '2026-08-08T09:00:00.000Z',
  durationSeconds: 2 * 3600,
  distanceMeters: 180_000,
};

test('passage time = departure + duration × progression', () => {
  assert.equal(passageTimeOnLeg(leg, 0.5).toISOString(), '2026-08-08T10:00:00.000Z');
  assert.equal(passageTimeOnLeg(leg, 0).toISOString(), leg.departureAt);
  assert.equal(passageTimeOnLeg(leg, 1.4).toISOString(), '2026-08-08T11:00:00.000Z');
});

test('presence window wraps the passage with margins and minimum on-site time', () => {
  const window = presenceWindowAroundPassage(new Date('2026-08-08T10:00:00.000Z'), 90);
  assert.equal(window.startAt.toISOString(), '2026-08-08T09:45:00.000Z');
  assert.equal(window.endAt.toISOString(), '2026-08-08T11:45:00.000Z');
});

test('temporal compatibility: start ≤ presence end AND end ≥ presence start', () => {
  const window = presenceWindowAroundPassage(new Date('2026-08-08T10:00:00.000Z'), 90);
  // Overlapping event.
  assert.ok(eventOverlapsWindow('2026-08-08T11:00:00.000Z', '2026-08-08T14:00:00.000Z', window));
  // Finished before the user arrives.
  assert.ok(!eventOverlapsWindow('2026-08-08T07:00:00.000Z', '2026-08-08T09:00:00.000Z', window));
  // Starts after the user is gone.
  assert.ok(!eventOverlapsWindow('2026-08-08T12:00:00.000Z', '2026-08-08T15:00:00.000Z', window));
  assert.equal(overlapMinutes('2026-08-08T11:00:00.000Z', '2026-08-08T14:00:00.000Z', window), 45);
});

test('stop presence window requires a valid arrival→departure period', () => {
  const stop: RoadtripWaypoint = {
    kind: 'stop',
    label: 'Strasbourg',
    coordinate: { latitude: 48.5734, longitude: 7.7521 },
    arrivalAt: '2026-08-08T17:00:00.000Z',
    departureAt: '2026-08-09T10:00:00.000Z',
  };
  const window = presenceWindowAtStop(stop);
  assert.ok(window);
  assert.equal(window.startAt.toISOString(), '2026-08-08T17:00:00.000Z');

  assert.equal(presenceWindowAtStop({ ...stop, departureAt: null }), null);
  assert.equal(presenceWindowAtStop({ ...stop, departureAt: '2026-08-08T16:00:00.000Z' }), null);
});

test('scheduled legs chain arrivals and honour declared stop departures', () => {
  const waypoints: RoadtripWaypoint[] = [
    { kind: 'origin', label: 'Paris', coordinate: { latitude: 48.85, longitude: 2.35 } },
    {
      kind: 'stop',
      label: 'Reims',
      coordinate: { latitude: 49.25, longitude: 4.03 },
      arrivalAt: null,
      departureAt: '2026-08-08T14:00:00.000Z',
    },
    { kind: 'destination', label: 'Strasbourg', coordinate: { latitude: 48.57, longitude: 7.75 } },
  ];
  const mapboxLegs = [
    { durationSeconds: 2 * 3600, distanceMeters: 180_000, geometry: leg.geometry },
    { durationSeconds: 3 * 3600, distanceMeters: 300_000, geometry: leg.geometry },
  ];

  const legs = buildScheduledLegs({
    waypoints,
    mapboxLegs,
    departureAt: '2026-08-08T09:00:00.000Z',
  });
  assert.equal(legs.length, 2);
  assert.equal(legs[0].departureAt, '2026-08-08T09:00:00.000Z');
  // Arrival 11:00 but the user declared leaving Reims at 14:00.
  assert.equal(legs[1].departureAt, '2026-08-08T14:00:00.000Z');

  // Without a declared departure the next leg starts at arrival time.
  const chained = buildScheduledLegs({
    waypoints: [
      waypoints[0],
      { ...waypoints[1], departureAt: null },
      waypoints[2],
    ],
    mapboxLegs,
    departureAt: '2026-08-08T09:00:00.000Z',
  });
  assert.equal(chained[1].departureAt, '2026-08-08T11:00:00.000Z');
});
