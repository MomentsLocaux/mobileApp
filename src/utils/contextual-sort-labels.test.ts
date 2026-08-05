import test from 'node:test';
import assert from 'node:assert/strict';
import { findContextualSortChoice, getContextualSortChoices } from './contextual-sort-labels';

const options = ['triage', 'distance', 'popularity', 'date', 'endDate'] as const;

test('live sorting uses outcome-oriented labels', () => {
  const choices = getContextualSortChoices('live', options);
  assert.ok(choices);
  assert.equal(
    findContextualSortChoice(choices, 'date', 'asc')?.label,
    'En cours depuis le plus longtemps',
  );
  assert.equal(findContextualSortChoice(choices, 'date', 'desc')?.label, 'Commencés récemment');
  assert.equal(findContextualSortChoice(choices, 'endDate', 'asc')?.label, 'Se terminent bientôt');
  assert.equal(findContextualSortChoice(choices, 'endDate', 'desc')?.label, 'Se terminent le plus tard');
});

test('upcoming sorting distinguishes start and end intent', () => {
  const choices = getContextualSortChoices('upcoming', options);
  assert.ok(choices);
  assert.equal(findContextualSortChoice(choices, 'date', 'asc')?.label, 'Commencent bientôt');
  assert.equal(findContextualSortChoice(choices, 'date', 'desc')?.label, 'Commencent plus tard');
  assert.equal(findContextualSortChoice(choices, 'endDate', 'asc')?.label, 'Se terminent le plus tôt');
  assert.equal(findContextualSortChoice(choices, 'endDate', 'desc')?.label, 'Se terminent le plus tard');
});

test('all and past keep the neutral technical control', () => {
  assert.equal(getContextualSortChoices('all', options), null);
  assert.equal(getContextualSortChoices('past', options), null);
});
