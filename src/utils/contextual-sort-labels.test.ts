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

test('past sorting describes completed events in the past tense', () => {
  const choices = getContextualSortChoices('past', options);
  assert.equal(
    findContextualSortChoice(choices, 'date', 'asc')?.label,
    'Ont commencé il y a longtemps',
  );
  assert.equal(findContextualSortChoice(choices, 'date', 'desc')?.label, 'Ont commencé récemment');
  assert.equal(
    findContextualSortChoice(choices, 'endDate', 'asc')?.label,
    'Terminés depuis le plus longtemps',
  );
  assert.equal(findContextualSortChoice(choices, 'endDate', 'desc')?.label, 'Terminés récemment');
});

test('all sorting stays chronologically neutral across event statuses', () => {
  const choices = getContextualSortChoices('all', options);
  assert.equal(
    findContextualSortChoice(choices, 'date', 'asc')?.label,
    'Début : du plus tôt au plus tard',
  );
  assert.equal(
    findContextualSortChoice(choices, 'date', 'desc')?.label,
    'Début : du plus tard au plus tôt',
  );
  assert.equal(
    findContextualSortChoice(choices, 'endDate', 'asc')?.label,
    'Fin : du plus tôt au plus tard',
  );
  assert.equal(
    findContextualSortChoice(choices, 'endDate', 'desc')?.label,
    'Fin : du plus tard au plus tôt',
  );
});

test('shared choices use outcome-oriented labels and unavailable choices stay hidden', () => {
  const choices = getContextualSortChoices('all', ['triage', 'popularity']);
  assert.deepEqual(
    choices.map(({ label }) => label),
    ['Recommandés', 'Les plus populaires'],
  );
});
