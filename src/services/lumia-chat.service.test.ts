import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchEventsLocally } from './lumia-chat.service';
import type { EventWithCreator } from '@/types/database';

const sample = (over: Partial<EventWithCreator> & { title: string; id: string }): EventWithCreator =>
  ({
    creator_id: 'c1',
    description: over.description ?? '',
    category: null,
    tags: [],
    starts_at: '2026-08-30T18:00:00.000Z',
    ends_at: '2026-08-30T21:00:00.000Z',
    schedule_mode: null,
    recurrence_rule: null,
    latitude: 45.75,
    longitude: 4.85,
    address: 'Lyon',
    city: 'Lyon',
    postal_code: null,
    venue_name: null,
    visibility: 'public',
    is_free: true,
    price: null,
    cover_url: null,
    max_participants: null,
    registration_required: null,
    external_url: null,
    contact_email: null,
    contact_phone: null,
    operating_hours: null,
    comments_count: 0,
    media_count: 0,
    rating_count: 0,
    rating_avg: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status: 'published',
    ambiance: null,
    ...over,
  }) as EventWithCreator;

describe('matchEventsLocally', () => {
  it('returns only catalog events that match tokens', () => {
    const catalog = [
      sample({ id: '1', title: 'Concert jazz à Lyon' }),
      sample({ id: '2', title: 'Vide-grenier à Nantes' }),
    ];
    const hits = matchEventsLocally('jazz lyon', catalog);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, '1');
  });

  it('does not invent events when nothing matches', () => {
    const hits = matchEventsLocally('opéra spatial', [sample({ id: '1', title: 'Marché bio' })]);
    assert.deepEqual(hits, []);
  });
});
