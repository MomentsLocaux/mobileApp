import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventWithCreator } from '@/types/database';
import {
  createProposalSession,
  getProposalSessionEvents,
  keepRecentProposalSessions,
  recordProposalDecision,
  reviseProposalDecision,
} from './proposal-session-history';
import type { ProposalPreferences } from './proposal.types';

const preferences: ProposalPreferences = {
  categoryIds: ['culture'],
  radiusKm: 25,
  anchor: { latitude: 49.61, longitude: 6.13, label: 'Luxembourg' },
  dateWindow: '7_days',
};

const event = (id: string) => ({ id, title: `Moment ${id}` }) as EventWithCreator;

test('a proposal session preserves progress and completes on the last card', () => {
  const first = event('first');
  const second = event('second');
  let session = createProposalSession([first, second], preferences, {
    id: 'session-1',
    now: '2026-08-04T10:00:00.000Z',
  });

  session = recordProposalDecision(session, first, 'pass', '2026-08-04T10:01:00.000Z');
  assert.equal(session.currentIndex, 1);
  assert.equal(session.status, 'in_progress');

  session = recordProposalDecision(session, second, 'like', '2026-08-04T10:02:00.000Z');
  assert.equal(session.currentIndex, 2);
  assert.equal(session.status, 'completed');
  assert.equal(session.completedAt, '2026-08-04T10:02:00.000Z');
  assert.deepEqual(getProposalSessionEvents(session).likedEvents.map((item) => item.id), ['second']);
});

test('a past choice can be revised without changing deck progress', () => {
  const first = event('first');
  let session = createProposalSession([first], preferences, { id: 'session-2' });
  session = recordProposalDecision(session, first, 'pass');
  const revised = reviseProposalDecision(session, first.id, 'like', '2026-08-04T11:00:00.000Z');

  assert.equal(revised.currentIndex, 1);
  assert.equal(revised.status, 'completed');
  assert.equal(revised.decisions[0].decision, 'like');
});

test('history retains the ten most recently updated sessions', () => {
  const sessions = Array.from({ length: 12 }, (_, index) =>
    createProposalSession([event(String(index))], preferences, {
      id: `session-${index}`,
      now: `2026-08-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    }),
  );

  const recent = keepRecentProposalSessions(sessions);
  assert.equal(recent.length, 10);
  assert.equal(recent[0].id, 'session-11');
  assert.equal(recent.at(-1)?.id, 'session-2');
});
