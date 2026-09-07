import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGoogleCalendarUrl,
  formatCalendarLocalStamp,
  resolveCalendarDates,
} from './event-calendar-format';

describe('event calendar helpers', () => {
  it('pads a local timestamp for Google Calendar template URLs', () => {
    const stamp = formatCalendarLocalStamp(new Date(2026, 8, 4, 19, 30, 0));
    assert.equal(stamp, '20260904T193000');
  });

  it('fills a missing end date with a one-hour window', () => {
    const dates = resolveCalendarDates('2026-09-04T17:00:00.000Z');
    assert.ok(dates);
    assert.equal(dates.end.getTime() - dates.start.getTime(), 60 * 60 * 1000);
  });

  it('builds a Google Calendar URL with title and location', () => {
    const url = buildGoogleCalendarUrl({
      id: 'evt-1',
      title: 'Marché de nuit',
      description: 'Place du village',
      startsAt: '2026-09-04T17:00:00.000Z',
      endsAt: '2026-09-04T19:00:00.000Z',
      locationLabel: 'Metz',
    });
    assert.match(url, /^https:\/\/www\.google\.com\/calendar\/render\?/);
    assert.match(url, /text=March%C3%A9%20de%20nuit/);
    assert.match(url, /location=Metz/);
    assert.match(url, /action=TEMPLATE/);
  });
});
