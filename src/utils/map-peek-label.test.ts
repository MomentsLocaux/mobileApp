import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatViewportPeekLabel } from './map-peek-label';

describe('formatViewportPeekLabel', () => {
  it('reports the current count once it is known', () => {
    assert.equal(
      formatViewportPeekLabel(24, 'all'),
      '24 événements dans la zone',
    );
  });

  it('reports an empty viewport', () => {
    assert.equal(
      formatViewportPeekLabel(0, 'all'),
      'Aucun événement dans la zone',
    );
  });
});
