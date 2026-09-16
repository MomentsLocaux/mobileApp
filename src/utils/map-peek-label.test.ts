import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatViewportPeekLabel } from './map-peek-label';

describe('formatViewportPeekLabel', () => {
  it('keeps the stale count while a refresh is in flight', () => {
    assert.equal(
      formatViewportPeekLabel(24, 'all', true),
      '24 événements dans la zone',
    );
  });

  it('says the zone is being searched when there is no count yet', () => {
    assert.equal(
      formatViewportPeekLabel(0, 'all', true),
      'Recherche dans la zone…',
    );
  });

  it('reports an empty viewport once loading has finished', () => {
    assert.equal(
      formatViewportPeekLabel(0, 'all', false),
      'Aucun événement dans la zone',
    );
  });
});
