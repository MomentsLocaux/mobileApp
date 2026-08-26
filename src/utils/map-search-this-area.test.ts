import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasLeftSearchedZone } from './map-search-this-area';

describe('search this area thresholds', () => {
  const searched = {
    sw: [2.0, 48.0] as [number, number],
    ne: [3.0, 49.0] as [number, number],
  };

  it('stays quiet for a small pan inside the zone', () => {
    const current = {
      sw: [2.05, 48.05] as [number, number],
      ne: [3.05, 49.05] as [number, number],
    };
    assert.equal(hasLeftSearchedZone(searched, current), false);
  });

  it('offers refresh after a meaningful center shift', () => {
    const current = {
      sw: [2.4, 48.0] as [number, number],
      ne: [3.4, 49.0] as [number, number],
    };
    assert.equal(hasLeftSearchedZone(searched, current), true);
  });

  it('offers refresh after a meaningful zoom change', () => {
    assert.equal(
      hasLeftSearchedZone(searched, searched, {
        searchedZoom: 12,
        currentZoom: 10.5,
      }),
      true
    );
  });

  it('does not offer refresh before the first search', () => {
    assert.equal(hasLeftSearchedZone(null, searched), false);
  });
});
