import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '@/types/database';
import { buildTimeline } from './roadtrip-timeline';
import type { RoadtripCandidate, RoadtripWaypoint } from './roadtrip.types';

const waypoints: RoadtripWaypoint[] = [
  { kind: 'origin', label: 'Paris', coordinate: { latitude: 48.85, longitude: 2.35 } },
  { kind: 'stop', label: 'Rouen', coordinate: { latitude: 49.44, longitude: 1.1 } },
  { kind: 'destination', label: 'Caen', coordinate: { latitude: 49.18, longitude: -0.37 } },
];

function candidate(partial: Partial<RoadtripCandidate> & { id: string; passageAt: string }): RoadtripCandidate {
  return {
    event: {
      id: partial.id,
      title: partial.id,
      latitude: 49,
      longitude: 1,
      starts_at: partial.passageAt,
      ends_at: partial.passageAt,
    } as EventWithCreator,
    origin: { kind: 'leg', legIndex: 0 },
    progression: 0.5,
    distanceToRouteKm: 1,
    estimatedDetourMinutes: 5,
    presenceStartAt: partial.passageAt,
    presenceEndAt: partial.passageAt,
    approximateTime: false,
    score: 0.5,
    ...partial,
  };
}

test('timeline groups by day then by leg/stop, ordered by passage time', () => {
  const candidates = [
    candidate({
      id: 'b-stop',
      passageAt: '2026-08-09T15:00:00.000Z',
      origin: { kind: 'stop', stopLabel: 'Rouen', distanceKm: 2 },
    }),
    candidate({
      id: 'a-leg0-late',
      passageAt: '2026-08-08T14:00:00.000Z',
      origin: { kind: 'leg', legIndex: 0 },
    }),
    candidate({
      id: 'a-leg0-early',
      passageAt: '2026-08-08T10:00:00.000Z',
      origin: { kind: 'leg', legIndex: 0 },
      score: 0.9,
    }),
    candidate({
      id: 'c-leg1',
      passageAt: '2026-08-08T18:00:00.000Z',
      origin: { kind: 'leg', legIndex: 1 },
    }),
  ];

  const days = buildTimeline({ candidates, waypoints });
  assert.equal(days.length, 2);
  assert.equal(days[0].dayKey, '2026-08-08');
  assert.equal(days[0].sections.length, 2);
  assert.equal(days[0].sections[0].title, 'Paris → Rouen');
  assert.deepEqual(
    days[0].sections[0].candidates.map((c) => c.event.id),
    ['a-leg0-early', 'a-leg0-late'],
  );
  assert.equal(days[0].sections[1].title, 'Rouen → Caen');
  assert.equal(days[1].sections[0].title, 'À Rouen');
  assert.equal(days[1].sections[0].candidates[0].event.id, 'b-stop');
});

test('empty candidates yield an empty timeline', () => {
  assert.deepEqual(buildTimeline({ candidates: [], waypoints }), []);
});
