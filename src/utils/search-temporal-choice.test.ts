import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filtersForSearchTemporalChoice,
  filtersForCustomDateRange,
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

  it('maps a custom date to the matching status scope', () => {
    assert.deepEqual(
      filtersForCustomDateRange({ startDate: '2026-09-10', endDate: '2026-09-12' }, '2026-08-31'),
      {
        status: 'upcoming',
        when: { startDate: '2026-09-10', endDate: '2026-09-12', includePast: false },
      }
    );
    assert.deepEqual(
      filtersForCustomDateRange({ startDate: '2026-08-01', endDate: '2026-08-02' }, '2026-08-31'),
      {
        status: 'past',
        when: { startDate: '2026-08-01', endDate: '2026-08-02', includePast: true },
      }
    );
    assert.deepEqual(
      filtersForCustomDateRange({ startDate: null, endDate: null }, '2026-08-31'),
      { status: 'live', when: {} }
    );
  });
});
