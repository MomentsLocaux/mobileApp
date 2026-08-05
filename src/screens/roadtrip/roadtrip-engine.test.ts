import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '@/types/database';
import { computeRoadtripCandidates } from './roadtrip-engine';
import type { RoadtripLeg, RoadtripPreferences, RoadtripWaypoint } from './roadtrip.types';

// Paris → Reims, departure 09:00 UTC, 2 h drive.
const legs: RoadtripLeg[] = [
  {
    index: 0,
    geometry: [
      [2.35, 48.85],
      [3.0, 48.9],
      [4.03, 49.25],
    ],
    departureAt: '2026-08-08T09:00:00.000Z',
    durationSeconds: 2 * 3600,
    distanceMeters: 160_000,
  },
];

const waypoints: RoadtripWaypoint[] = [
  { kind: 'origin', label: 'Paris', coordinate: { latitude: 48.85, longitude: 2.35 } },
  {
    kind: 'destination',
    label: 'Reims',
    coordinate: { latitude: 49.25, longitude: 4.03 },
    arrivalAt: '2026-08-08T11:00:00.000Z',
    departureAt: '2026-08-08T18:00:00.000Z',
  },
];

const preferences: RoadtripPreferences = {
  categoryValues: [],
  detourBudgetMinutes: 20,
  searchZone: 'both',
  freeOnly: false,
  minOnSiteMinutes: 90,
  timeConfirmed: true,
};

function event(overrides: Partial<EventWithCreator>): EventWithCreator {
  return {
    id: 'event-default',
    title: 'Moment local',
    description: 'Un événement local avec une description suffisamment longue pour compter.',
    category: 'music',
    starts_at: '2026-08-08T09:30:00.000Z',
    ends_at: '2026-08-08T12:00:00.000Z',
    // Near the middle of the route.
    latitude: 48.91,
    longitude: 3.0,
    status: 'published',
    visibility: 'public',
    is_free: true,
    cover_url: 'https://example.com/cover.jpg',
    venue_name: 'Salle des fêtes',
    address: '1 rue du Centre',
    operating_hours: null,
    ...overrides,
  } as EventWithCreator;
}

test('an event on the route, temporally compatible, is proposed with an explanation payload', () => {
  const [candidate] = computeRoadtripCandidates({
    events: [event({})],
    legs,
    waypoints,
    preferences,
  });
  assert.ok(candidate);
  assert.equal(candidate.origin.kind, 'leg');
  assert.ok(candidate.estimatedDetourMinutes <= 20);
  // Passage roughly mid-leg → around 10:00.
  const passage = new Date(candidate.passageAt).getTime();
  assert.ok(Math.abs(passage - new Date('2026-08-08T10:00:00.000Z').getTime()) < 20 * 60_000);
  assert.equal(candidate.approximateTime, false);
  assert.ok(candidate.score > 0.5);
});

test('mandatory exclusions: unpublished, private, missing coords, finished, off-corridor, over detour budget', () => {
  const run = (events: EventWithCreator[], prefs = preferences) =>
    computeRoadtripCandidates({ events, legs, waypoints, preferences: prefs });

  assert.equal(run([event({ status: 'pending' })]).length, 0);
  assert.equal(run([event({ visibility: 'private' as EventWithCreator['visibility'] })]).length, 0);
  assert.equal(run([event({ latitude: undefined as unknown as number })]).length, 0);
  // Finished before the 10:00 passage.
  assert.equal(
    run([
      event({ starts_at: '2026-08-08T06:00:00.000Z', ends_at: '2026-08-08T08:00:00.000Z' }),
    ]).length,
    0,
  );
  // ~55 km north of the corridor.
  assert.equal(run([event({ latitude: 49.4, longitude: 3.0 })]).length, 0);
  // In corridor at 20 min budget, out at 10 min budget (~5 km ≈ 13 min detour).
  const offRoute = event({ latitude: 48.955, longitude: 3.0 });
  assert.equal(run([offRoute]).length, 1);
  assert.equal(run([offRoute], { ...preferences, detourBudgetMinutes: 10 }).length, 0);
});

test('preference filters: categories and free-only', () => {
  const paid = event({ id: 'paid', is_free: false });
  const withCategories = { ...preferences, categoryValues: ['market'] };
  assert.equal(
    computeRoadtripCandidates({ events: [event({})], legs, waypoints, preferences: withCategories })
      .length,
    0,
  );
  assert.equal(
    computeRoadtripCandidates({
      events: [paid],
      legs,
      waypoints,
      preferences: { ...preferences, freeOnly: true },
    }).length,
    0,
  );
});

test('an event near a stop matches through the declared presence window', () => {
  // 3 km from Reims, during the 11:00→18:00 stop window but far from mid-route passage times.
  const nearStop = event({
    id: 'near-stop',
    latitude: 49.27,
    longitude: 4.06,
    starts_at: '2026-08-08T14:00:00.000Z',
    ends_at: '2026-08-08T17:00:00.000Z',
  });
  const [candidate] = computeRoadtripCandidates({
    events: [nearStop],
    legs,
    waypoints,
    preferences,
  });
  assert.ok(candidate);
  assert.equal(candidate.origin.kind, 'stop');
  if (candidate.origin.kind === 'stop') {
    assert.equal(candidate.origin.stopLabel, 'Reims');
    assert.ok(candidate.origin.distanceKm < 5);
  }

  // Zone restricted to the route: the same event is no longer proposed.
  assert.equal(
    computeRoadtripCandidates({
      events: [nearStop],
      legs,
      waypoints,
      preferences: { ...preferences, searchZone: 'route' },
    }).length,
    0,
  );
});

test('ranking is deterministic: better temporal fit and smaller detour win', () => {
  const onRoute = event({ id: 'a-on-route' });
  const farther = event({ id: 'b-farther', latitude: 48.96, longitude: 2.99 });
  const results = computeRoadtripCandidates({
    events: [farther, onRoute],
    legs,
    waypoints,
    preferences,
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].event.id, 'a-on-route');
  assert.ok(results[0].score > results[1].score);
});

test('date without time flags candidates as "Horaire à confirmer"', () => {
  const [candidate] = computeRoadtripCandidates({
    events: [event({})],
    legs,
    waypoints,
    preferences: { ...preferences, timeConfirmed: false },
  });
  assert.ok(candidate);
  assert.equal(candidate.approximateTime, true);
});
