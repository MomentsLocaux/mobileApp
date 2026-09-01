import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  closeOpenDateRange,
  formatRangeSelectionLabel,
  isSingleDayRange,
  nextDateRangeOnDayPress,
  toDateOnlyString,
} from './date-range-selection';

describe('date range selection', () => {
  it('keeps YYYY-MM-DD strings as calendar days', () => {
    assert.equal(toDateOnlyString('2026-09-15T18:30:00.000Z'), '2026-09-15');
  });

  it('closes a one-tap day into a one-day window', () => {
    assert.deepEqual(closeOpenDateRange({ startDate: '2026-09-15', endDate: null }), {
      startDate: '2026-09-15',
      endDate: '2026-09-15',
    });
  });

  it('treats start === end as a single-day selection', () => {
    assert.equal(isSingleDayRange({ startDate: '2026-09-15', endDate: '2026-09-15' }), true);
    assert.equal(isSingleDayRange({ startDate: '2026-09-15', endDate: '2026-09-16' }), false);
  });

  it('selects one day on the first tap in range mode', () => {
    assert.deepEqual(
      nextDateRangeOnDayPress('range', { startDate: null, endDate: null }, '2026-09-15'),
      { startDate: '2026-09-15', endDate: null }
    );
  });

  it('keeps the same day on a second tap', () => {
    assert.deepEqual(
      nextDateRangeOnDayPress(
        'range',
        { startDate: '2026-09-15', endDate: null },
        '2026-09-15'
      ),
      { startDate: '2026-09-15', endDate: null }
    );
  });

  it('completes a period on a second tap, regardless of order', () => {
    assert.deepEqual(
      nextDateRangeOnDayPress(
        'range',
        { startDate: '2026-09-15', endDate: null },
        '2026-09-18'
      ),
      { startDate: '2026-09-15', endDate: '2026-09-18' }
    );
    assert.deepEqual(
      nextDateRangeOnDayPress(
        'range',
        { startDate: '2026-09-15', endDate: null },
        '2026-09-10'
      ),
      { startDate: '2026-09-10', endDate: '2026-09-15' }
    );
  });

  it('extends a stored one-day window into a period', () => {
    assert.deepEqual(
      nextDateRangeOnDayPress(
        'range',
        { startDate: '2026-09-15', endDate: '2026-09-15' },
        '2026-09-18'
      ),
      { startDate: '2026-09-15', endDate: '2026-09-18' }
    );
  });

  it('starts over after a multi-day period', () => {
    assert.deepEqual(
      nextDateRangeOnDayPress(
        'range',
        { startDate: '2026-09-15', endDate: '2026-09-18' },
        '2026-09-20'
      ),
      { startDate: '2026-09-20', endDate: null }
    );
  });

  it('labels a one-day pick without a dash', () => {
    assert.equal(
      formatRangeSelectionLabel({ startDate: '2026-09-15', endDate: null }),
      '15/09'
    );
    assert.equal(
      formatRangeSelectionLabel({ startDate: '2026-09-15', endDate: '2026-09-18' }),
      '15/09–18/09'
    );
  });
});
