import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventCardRangeLine, getEventCardDateStamp } from './event-card-meta';

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

test('discovery stamps keep the start time on a same-day event', () => {
  const stamp = getEventCardDateStamp({
    starts_at: new Date(2026, 8, 26, 16, 30, 0).toISOString(),
    ends_at: new Date(2026, 8, 26, 18, 0, 0).toISOString(),
  });
  assert.match(stamp.primary, /26/);
  assert.match(stamp.secondary ?? '', TIME_RE);
  assert.equal(stamp.kind, 'time');
});

test('discovery stamps show the period for a long-running event', () => {
  const stamp = getEventCardDateStamp({
    starts_at: new Date(2026, 5, 1, 10, 0, 0).toISOString(),
    ends_at: new Date(2026, 8, 30, 18, 0, 0).toISOString(),
  });
  assert.match(stamp.primary, /1/);
  assert.match(stamp.secondary ?? '', /→/);
  assert.match(stamp.secondary ?? '', /30/);
  assert.equal(TIME_RE.test(stamp.primary), false);
  assert.equal(TIME_RE.test(stamp.secondary ?? ''), false);
  assert.equal(stamp.kind, 'period');
});

test('discovery stamps include years when the period crosses a year', () => {
  const stamp = getEventCardDateStamp({
    starts_at: new Date(2025, 11, 20, 10, 0, 0).toISOString(),
    ends_at: new Date(2026, 0, 5, 18, 0, 0).toISOString(),
  });
  assert.match(stamp.primary, /2025/);
  assert.match(stamp.secondary ?? '', /2026/);
});
