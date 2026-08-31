import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import { filterEvents } from './filter-events';

const event = (id: string, startsAt: string, endsAt: string): EventWithCreator =>
  ({
    id,
    title: id,
    starts_at: startsAt,
    ends_at: endsAt,
    visibility: 'public',
    is_free: true,
    tags: [],
  }) as unknown as EventWithCreator;

describe('event client filters', () => {
  it('keeps an event whose duration overlaps a custom date range', () => {
    const spanning = event('spanning', '2099-01-01T10:00:00.000Z', '2099-01-10T18:00:00.000Z');
    const finishedBefore = event('before', '2099-01-01T10:00:00.000Z', '2099-01-02T18:00:00.000Z');

    const result = filterEvents([spanning, finishedBefore], {
      startDate: '2099-01-05',
      endDate: '2099-01-06',
    });

    assert.deepEqual(result.map((item) => item.id), ['spanning']);
  });

  it('keeps events whose title or description contains every name token', () => {
    const marche = event('marche', '2099-01-01T10:00:00.000Z', '2099-01-01T18:00:00.000Z');
    (marche as { title: string }).title = 'Marché de Noël';
    const concert = event('concert', '2099-01-01T10:00:00.000Z', '2099-01-01T18:00:00.000Z');
    (concert as { title: string }).title = 'Bal folk';
    (concert as { description: string }).description = 'Concert jazz en salle';

    const byTitle = filterEvents([marche, concert], { name: 'marché' });
    assert.deepEqual(byTitle.map((item) => item.id), ['marche']);

    const byDescription = filterEvents([marche, concert], { name: 'jazz' });
    assert.deepEqual(byDescription.map((item) => item.id), ['concert']);
  });
});
