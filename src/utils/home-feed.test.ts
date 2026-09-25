import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import {
  buildHomeHero,
  eventMatchesHomeSlot,
  homeDistanceKm,
  mapMomentsCta,
  countHomeSlotEvents,
  defaultHomeTimeSlot,
  filtersForHomeTimeSlot,
  focusForHomeEvents,
  hasSaturdayPlan,
  HOME_CARD_LIMIT,
  rankHomeEvents,
  selectLocalPulse,
  selectNextAgendaEvent,
  selectSocialSignal,
} from './home-feed';

import { eventMatchesDatePreset } from './event-date-windows';

const NOW = new Date(2026, 8, 24, 12, 0, 0);

const event = (
  id: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<EventWithCreator> = {},
): EventWithCreator =>
  ({
    id,
    status: 'published',
    visibility: 'public',
    title: id,
    starts_at: startsAt,
    ends_at: endsAt,
    latitude: 49.36,
    longitude: 6.16,
    city: 'Thionville',
    category: 'culture',
    interests_count: 0,
    likes_count: 0,
    created_at: '2026-09-20T10:00:00',
    ...extra,
  }) as EventWithCreator;

describe('home feed slots', () => {
  it('defaults to the moment that deserves attention', () => {
    assert.equal(defaultHomeTimeSlot(NOW), 'now');
    assert.equal(defaultHomeTimeSlot(new Date(2026, 8, 24, 18, 30, 0)), 'tonight');
    assert.equal(defaultHomeTimeSlot(new Date(2026, 8, 26, 11, 0, 0)), 'weekend');
  });

  it('keeps live events in Maintenant and evening events in Ce soir', () => {
    const live = event('live', '2026-09-24T11:00:00', '2026-09-24T13:00:00');
    const tonight = event('tonight', '2026-09-24T19:00:00', '2026-09-24T21:00:00');
    const tomorrow = event('tomorrow', '2026-09-25T11:00:00', '2026-09-25T12:00:00');
    assert.equal(countHomeSlotEvents([live, tonight, tomorrow], 'now', NOW), 1);
    assert.equal(countHomeSlotEvents([live, tonight, tomorrow], 'tonight', NOW), 1);
    assert.equal(countHomeSlotEvents([live, tonight, tomorrow], 'tomorrow', NOW), 1);
  });

  it('maps slots onto the existing map temporal filters', () => {
    assert.equal(filtersForHomeTimeSlot('now').when.preset, undefined);
    assert.equal(filtersForHomeTimeSlot('now').status, 'live');
    assert.equal(filtersForHomeTimeSlot('tonight').when.preset, 'tonight');
    assert.equal(filtersForHomeTimeSlot('tomorrow').when.preset, 'tomorrow');
    assert.equal(filtersForHomeTimeSlot('weekend').when.preset, 'weekend');
  });
});

describe('rankHomeEvents', () => {
  it('returns at most three events and prefers another category', () => {
    const concerts = ['a', 'b', 'c'].map((id, index) =>
      event(id, `2026-09-24T${18 + index}:00:00`, `2026-09-24T${19 + index}:00:00`, {
        category: 'concert',
        interests_count: 40 - index,
        latitude: 49.36,
        longitude: 6.16,
      }),
    );
    const market = event('market', '2026-09-24T18:30:00', '2026-09-24T20:00:00', {
      category: 'market',
      interests_count: 12,
      latitude: 49.37,
      longitude: 6.17,
    });
    const ranked = rankHomeEvents([...concerts, market], {
      now: NOW,
      slot: 'tonight',
      center: { latitude: 49.36, longitude: 6.16 },
    });
    assert.equal(ranked.length, HOME_CARD_LIMIT);
    assert.ok(ranked.some((item) => item.category === 'market'));
  });
});

describe('home editorial blocks', () => {
  it('opens the weekend with a short hero', () => {
    const hero = buildHomeHero({
      now: new Date(2026, 8, 25, 18, 0, 0),
      nearbyCount: 32,
      isAuthenticated: false,
      hasSaturdayPlan: false,
    });
    assert.equal(hero.title, 'Le week-end commence ici');
    assert.match(hero.subtitle || '', /32 moments/);
  });

  it('hides the next moment when nothing is saved', () => {
    const past = event('past', '2026-09-23T18:00:00', '2026-09-23T20:00:00');
    assert.equal(selectNextAgendaEvent([past], NOW), null);
    const next = event('next', '2026-09-26T15:00:00', '2026-09-26T17:00:00');
    assert.equal(selectNextAgendaEvent([past, next], NOW)?.id, 'next');
    assert.equal(hasSaturdayPlan([next], NOW), true);
  });

  it('picks one active city and one social line', () => {
    const pulse = selectLocalPulse(
      [
        event('a', '2026-09-24T19:00:00', '2026-09-24T21:00:00', { city: 'Thionville' }),
        event('b', '2026-09-24T19:30:00', '2026-09-24T21:30:00', { city: 'Thionville' }),
        event('c', '2026-09-24T20:00:00', '2026-09-24T22:00:00', { city: 'Hayange', latitude: 49.33, longitude: 6.06 }),
      ],
      { now: NOW, slot: 'tonight', center: { latitude: 49.36, longitude: 6.16 } },
    );
    assert.equal(pulse?.city, 'Thionville');
    assert.match(pulse?.headline || '', /ce soir/);

    const signal = selectSocialSignal(
      [event('fest', '2026-09-26T16:00:00', '2026-09-26T18:00:00', { title: 'Festival du Parc' })],
      {
        fest: {
          friendsGoingCount: 3,
          likers: [],
        },
      },
      NOW,
    );
    assert.equal(signal?.title, 'Festival du Parc');
    assert.equal(signal?.caption, '3 personnes que tu suis ont enregistré');
    assert.equal(selectSocialSignal([event('quiet', '2026-09-26T16:00:00', '2026-09-26T18:00:00')], {}, NOW), null);
  });
});

describe('home consistency and factual recommendations', () => {
  it('shares the exact evening window with map filters, including cross-midnight events', () => {
    const samples = [
      event('afternoon', '2026-09-24T14:00:00', '2026-09-24T16:59:00'),
      event('overlap', '2026-09-24T16:00:00', '2026-09-24T18:00:00'),
      event('night', '2026-09-24T23:00:00', '2026-09-25T02:00:00'),
      event('tomorrow', '2026-09-25T00:01:00', '2026-09-25T02:00:00'),
    ];
    const preset = filtersForHomeTimeSlot('tonight').when.preset!;
    assert.deepEqual(samples.filter(e => eventMatchesHomeSlot(e, 'tonight', NOW)).map(e => e.id), ['overlap', 'night']);
    for (const sample of samples) assert.equal(eventMatchesHomeSlot(sample, 'tonight', NOW), eventMatchesDatePreset(sample, preset, NOW));
  });

  it('deduplicates, excludes the next saved moment, rejects unpublished and private events', () => {
    const a = event('a', '2026-09-24T18:00:00', '2026-09-24T20:00:00');
    const result = rankHomeEvents([a, a, { ...a, id: 'draft', status: 'draft' }, { ...a, id: 'private', visibility: 'prive' }, { ...a, id: 'next' }, { ...a, id: 'b', title: 'Another idea' }], { now: NOW, slot: 'tonight', excludeIds: ['next'], limit: 20 });
    assert.deepEqual(result.map(e => e.id), ['a', 'b']);
    assert.equal(countHomeSlotEvents([a, a], 'tonight', NOW), 1);
  });

  it('resolves preferences through taxonomy UUIDs and avoids repetitive titles', () => {
    const base = event('a', '2026-09-24T18:00:00', '2026-09-24T20:00:00');
    const result = rankHomeEvents([base, { ...base, id: 'b', category: 'uuid', title: 'Balade' }, { ...base, id: 'c' }, { ...base, id: 'd', title: 'Marché', category: 'market' }], { now: NOW, slot: 'tonight', preferredCategorySlugs: ['nature'], categorySlugs: { uuid: 'nature' } });
    assert.equal(result[0].id, 'b');
    assert.equal(result.filter(e => e.title === 'a').length, 1);
    assert.equal(result.length, 3);
  });

  it('never falls back to a city outside the selected period and includes every pin in its radius', () => {
    const a = event('a', '2026-09-24T18:00:00', '2026-09-24T20:00:00');
    const b = { ...a, id: 'b', latitude: 49.41, longitude: 6.22 };
    assert.equal(selectLocalPulse([a, b], { now: NOW, slot: 'tomorrow' }), null);
    const pulse = selectLocalPulse([a, b], { now: NOW, slot: 'tonight' })!;
    assert.equal(pulse.count, 2);
    assert.equal(pulse.slot, 'tonight');
    for (const e of [a, b]) assert.ok(homeDistanceKm(pulse.center.latitude, pulse.center.longitude, e.latitude, e.longitude) < pulse.radiusKm);
    const tight = focusForHomeEvents([a], { latitude: a.latitude, longitude: a.longitude, radiusKm: 20 });
    assert.equal(tight.radiusKm, 2);
    const wide = focusForHomeEvents([a, { ...b, latitude: 49.5, longitude: 6.4 }], { latitude: 49.36, longitude: 6.16, radiusKm: 20 });
    assert.ok(wide.radiusKm <= 20);
    assert.ok(wide.radiusKm > 2);
  });

  it('does not attribute a save to a liker or imply attendance', () => {
    const a = event('a', '2026-09-26T18:00:00', '2026-09-26T20:00:00');
    const signal = selectSocialSignal([a], { a: { friendsGoingCount: 1, likers: [{ id: 'alice', display_name: 'Alice', avatar_url: null, is_followed: true }] } }, NOW);
    assert.equal(signal?.caption, 'Une personne que tu suis a enregistré');
  });

  it('does not announce exact totals for a capped or restored pool', () => {
    assert.equal(mapMomentsCta(120, false), 'Explorer cette période sur la carte');
    const hero = buildHomeHero({ now: new Date(2026, 8, 23, 19), nearbyCount: 24, todayCount: 1, complete: true, isAuthenticated: false, hasSaturdayPlan: false });
    assert.match(hero.subtitle!, /^1 moment a lieu/);
  });

  it('keeps only a strictly upcoming saved moment within thirty days', () => {
    const live = event('live', '2026-09-24T11:00:00', '2026-09-24T13:00:00');
    const distant = event('distant', '2026-12-01T11:00:00', '2026-12-01T13:00:00');
    assert.equal(selectNextAgendaEvent([live, distant], NOW), null);
  });
});
