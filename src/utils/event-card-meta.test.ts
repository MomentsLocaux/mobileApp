import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventCardRangeLine } from './event-card-meta';

const TIME_RE = /\d{2}:\d{2}/;

test('proposal cards can hide hours on a same-day range', () => {
  const event = {
    starts_at: new Date(2026, 7, 15, 18, 0, 0).toISOString(),
    ends_at: new Date(2026, 7, 15, 22, 0, 0).toISOString(),
  };
  const withTime = formatEventCardRangeLine(event, 'compact');
  const withoutTime = formatEventCardRangeLine(event, 'compact', { includeTime: false });

  assert.equal(TIME_RE.test(withTime), true);
  assert.equal(TIME_RE.test(withoutTime), false);
  assert.match(withoutTime, /15/);
});

test('proposal cards hide hours on a multi-day range', () => {
  const event = {
    starts_at: new Date(2026, 7, 15, 18, 0, 0).toISOString(),
    ends_at: new Date(2026, 7, 17, 20, 0, 0).toISOString(),
  };
  const withoutTime = formatEventCardRangeLine(event, 'compact', { includeTime: false });

  assert.equal(TIME_RE.test(withoutTime), false);
  assert.match(withoutTime, /→/);
});
