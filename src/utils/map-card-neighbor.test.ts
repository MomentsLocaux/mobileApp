import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nearestEventForCardSwipe } from './map-card-neighbor';

const here = {
  id: 'current',
  latitude: 48.8566,
  longitude: 2.3522,
};

describe('nearest event for a map card swipe', () => {
  it('picks the closest event to the west on a left swipe', () => {
    const nearWest = { id: 'near-west', latitude: 48.857, longitude: 2.34 };
    const farWest = { id: 'far-west', latitude: 48.86, longitude: 2.2 };
    const east = { id: 'east', latitude: 48.856, longitude: 2.37 };
    const next = nearestEventForCardSwipe(here, [farWest, east, nearWest, here], 'left');
    assert.equal(next?.id, 'near-west');
  });

  it('picks the closest event to the east on a right swipe', () => {
    const nearEast = { id: 'near-east', latitude: 48.857, longitude: 2.36 };
    const farEast = { id: 'far-east', latitude: 48.9, longitude: 2.5 };
    const west = { id: 'west', latitude: 48.856, longitude: 2.3 };
    const next = nearestEventForCardSwipe(here, [farEast, west, nearEast], 'right');
    assert.equal(next?.id, 'near-east');
  });

  it('stays put when nothing lies on that side', () => {
    const west = { id: 'west', latitude: 48.856, longitude: 2.3 };
    assert.equal(nearestEventForCardSwipe(here, [west], 'right'), null);
  });

  it('ignores an event without coordinates', () => {
    const west = { id: 'west', latitude: 48.856, longitude: 2.3 };
    const blank = { id: 'blank', latitude: null as number | null, longitude: null as number | null };
    assert.equal(nearestEventForCardSwipe(here, [blank], 'left'), null);
    assert.equal(nearestEventForCardSwipe(here, [blank, west], 'left')?.id, 'west');
  });
});
