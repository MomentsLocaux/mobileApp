import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EventWithCreator } from '../types/database';
import { boundsForFavoritePins, buildFavoriteMapPins } from './favorite-map-pins';

const event = (id: string, latitude?: number, longitude?: number): EventWithCreator =>
  ({ id, title: id, latitude, longitude }) as EventWithCreator;

describe('favorite map pins', () => {
  it('skips events without usable coordinates', () => {
    const pins = buildFavoriteMapPins([
      event('ok', 44.36, 5.14),
      event('zero', 0, 0),
      event('missing'),
    ]);
    assert.deepEqual(
      pins.map((pin) => pin.id),
      ['ok'],
    );
  });

  it('builds bounds covering every pin', () => {
    const pins = buildFavoriteMapPins([
      event('south', 44.1, 5.0),
      event('north', 44.5, 5.3),
    ]);
    assert.deepEqual(boundsForFavoritePins(pins), {
      ne: [5.3, 44.5],
      sw: [5.0, 44.1],
    });
  });
});
