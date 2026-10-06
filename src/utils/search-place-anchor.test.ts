import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DISCOVERY_DEFAULT_RADIUS_KM } from '../constants/filters';
import { hasSearchPlaceAnchor } from './search-helpers';

const gps = { latitude: 49.18, longitude: -0.37 };

describe('hasSearchPlaceAnchor', () => {
  it('accepts a chosen place without GPS', () => {
    assert.equal(
      hasSearchPlaceAnchor({ center: gps, radiusKm: 25, label: 'Caen' }, null),
      true
    );
  });

  it('accepts GPS when a radius can bound the query', () => {
    assert.equal(
      hasSearchPlaceAnchor({ center: null, radiusKm: DISCOVERY_DEFAULT_RADIUS_KM }, gps),
      true
    );
  });

  it('rejects a radius or a date-only search when no coordinates exist', () => {
    assert.equal(
      hasSearchPlaceAnchor({ center: null, radiusKm: 25 }, null),
      false
    );
    assert.equal(hasSearchPlaceAnchor({ center: null }, null), false);
    assert.equal(hasSearchPlaceAnchor({ center: null }, gps), false);
  });
});
