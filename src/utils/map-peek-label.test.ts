import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatViewportPeekHeading,
  formatViewportPeekLabel,
  formatViewportPeekSubtitle,
} from './map-peek-label';

describe('formatViewportPeekHeading', () => {
  it('counts Moments in the visible zone', () => {
    assert.equal(formatViewportPeekHeading(19), '19 Moments dans la zone');
    assert.equal(formatViewportPeekHeading(1), '1 Moment dans la zone');
    assert.equal(formatViewportPeekHeading(0), 'Aucun Moment dans la zone');
  });

  it('keeps status wording', () => {
    assert.equal(
      formatViewportPeekHeading(3, 'live'),
      '3 Moments en cours dans la zone',
    );
  });
});

describe('formatViewportPeekSubtitle', () => {
  it('invites to browse when the zone has moments', () => {
    assert.equal(
      formatViewportPeekSubtitle(19),
      'Découvre tous les Moments proposés',
    );
  });

  it('explains an empty zone', () => {
    assert.equal(
      formatViewportPeekSubtitle(0),
      'Aucun Moment proposé pour le moment',
    );
  });
});

describe('formatViewportPeekLabel', () => {
  it('reports the current count once it is known', () => {
    assert.equal(formatViewportPeekLabel(24, 'all'), '24 Moments dans la zone');
  });

  it('reports an empty viewport', () => {
    assert.equal(formatViewportPeekLabel(0, 'all'), 'Aucun Moment dans la zone');
  });

  it('keeps status wording', () => {
    assert.equal(
      formatViewportPeekLabel(3, 'live'),
      '3 Moments en cours dans la zone',
    );
  });
});
