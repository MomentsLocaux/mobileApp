import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filtersForSearchTemporalChoice,
  filtersForCustomDateRange,
  isDefaultDiscoveryTemporal,
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
      filtersForCustomDateRange({ startDate: '2026-09-10', endDate: null }, '2026-08-31'),
      {
        status: 'upcoming',
        when: { startDate: '2026-09-10', endDate: '2026-09-10', includePast: false },
      }
    );
    assert.deepEqual(
      filtersForCustomDateRange({ startDate: '2026-08-31', endDate: '2026-08-31' }, '2026-08-31'),
      {
        status: 'all',
        when: { startDate: '2026-08-31', endDate: '2026-08-31', includePast: false },
      }
    );
    assert.deepEqual(
      filtersForCustomDateRange({ startDate: null, endDate: null }, '2026-08-31'),
      { status: 'all', when: { preset: 'today', includePast: false } }
    );
  });

  it('treats Aujourd’hui as the default discovery temporal package', () => {
    assert.deepEqual(filtersForSearchTemporalChoice('today'), {
      status: 'all',
      when: { preset: 'today', includePast: false },
    });
    assert.equal(
      isDefaultDiscoveryTemporal('all', { preset: 'today', includePast: false }),
      true
    );
    assert.equal(isDefaultDiscoveryTemporal('live', {}), false);
    assert.equal(isDefaultDiscoveryTemporal('all', {}), false);
  });
});
