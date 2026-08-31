import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filtersForSearchTemporalChoice,
  resolveSearchTemporalChoice,
} from './search-temporal-choice';

describe('search temporal choice', () => {
  it('maps status choices without leaving a contradictory date preset', () => {
    assert.deepEqual(filtersForSearchTemporalChoice('past'), {
      status: 'past',
      when: {},
    });
    assert.deepEqual(filtersForSearchTemporalChoice('live'), {
      status: 'live',
      when: {},
    });
  });

  it('maps date presets to the neutral status axis', () => {
    assert.deepEqual(filtersForSearchTemporalChoice('tomorrow'), {
      status: 'all',
      when: { preset: 'tomorrow', includePast: false },
    });
    assert.equal(
      resolveSearchTemporalChoice('all', { preset: 'tomorrow', includePast: false }),
      'tomorrow'
    );
  });

  it('keeps custom date ranges distinct from quick presets', () => {
    assert.equal(
      resolveSearchTemporalChoice('all', { startDate: '2026-09-01' }),
      null
    );
  });
});
