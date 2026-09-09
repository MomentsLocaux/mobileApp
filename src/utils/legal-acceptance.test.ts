import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldWriteLegalAcceptance } from './legal-acceptance';

test('writes when no previous acceptance exists', () => {
  assert.equal(shouldWriteLegalAcceptance(null, '2026-09-09'), true);
  assert.equal(
    shouldWriteLegalAcceptance(
      { legal_accepted_at: null, legal_policy_version: null },
      '2026-09-09',
    ),
    true,
  );
});

test('does not rewrite the same policy version', () => {
  assert.equal(
    shouldWriteLegalAcceptance(
      { legal_accepted_at: '2026-09-09T10:00:00.000Z', legal_policy_version: '2026-09-09' },
      '2026-09-09',
    ),
    false,
  );
});

test('writes again when the policy version changes', () => {
  assert.equal(
    shouldWriteLegalAcceptance(
      { legal_accepted_at: '2026-09-09T10:00:00.000Z', legal_policy_version: '2026-09-09' },
      '2026-10-01',
    ),
    true,
  );
});
