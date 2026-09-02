import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bugToHistoryItem,
  correctionToHistoryItem,
  eventSuggestToHistoryItem,
  filterSuggestionHistory,
  isCommunitySuggestedEvent,
  isSuggestionHistoryCacheFresh,
  mergeSuggestionHistory,
} from './suggestion-history';

test('community suggest is distinct from organizer create', () => {
  assert.equal(isCommunitySuggestedEvent('community_suggest'), true);
  assert.equal(isCommunitySuggestedEvent('organizer_create'), false);
  assert.equal(isCommunitySuggestedEvent(null), false);
});

test('suggested event maps status, place and edit href for refused rows', () => {
  const item = eventSuggestToHistoryItem({
    id: 'e1',
    title: 'Marché de nuit',
    status: 'refused',
    city: 'Lyon',
    refusal_reason: 'Lieu trop vague',
    created_at: '2026-09-01T10:00:00.000Z',
    submission_source: 'community_suggest',
  });
  assert.equal(item.kind, 'event_suggest');
  assert.equal(item.statusLabel, 'Refusé');
  assert.equal(item.tone, 'danger');
  assert.equal(item.subtitle, 'Lyon');
  assert.equal(item.href, '/events/create?edit=e1');
  assert.equal(item.reviewNote, 'Lieu trop vague');
});

test('published suggested event opens the public fiche', () => {
  const item = eventSuggestToHistoryItem({
    id: 'e2',
    title: 'Concert',
    status: 'published',
    created_at: '2026-09-01T10:00:00.000Z',
  });
  assert.equal(item.statusLabel, 'Publié');
  assert.equal(item.href, '/events/e2');
});

test('field correction uses event title and comment', () => {
  const item = correctionToHistoryItem({
    id: 'c1',
    kind: 'field_correction',
    comment: 'L’horaire est 20h, pas 18h',
    status: 'pending',
    created_at: '2026-09-01T12:00:00.000Z',
    event_id: 'ev-9',
    event: { title: 'Apéro jazz' },
  });
  assert.equal(item.kind, 'field_correction');
  assert.equal(item.title, 'Apéro jazz');
  assert.equal(item.subtitle, 'L’horaire est 20h, pas 18h');
  assert.equal(item.statusLabel, 'En validation');
  assert.equal(item.href, '/events/ev-9');
});

test('duplicate correction falls back when the related title is missing', () => {
  const item = correctionToHistoryItem({
    id: 'c2',
    kind: 'duplicate',
    comment: 'Même soirée que l’autre fiche',
    status: 'accepted',
    created_at: '2026-09-01T13:00:00.000Z',
    event_id: 'ev-1',
    duplicate_hint: 'Voir ev-2',
  });
  assert.equal(item.kind, 'duplicate');
  assert.equal(item.title, 'Signalement de doublon');
  assert.equal(item.subtitle, 'Voir ev-2');
  assert.equal(item.statusLabel, 'Acceptée');
  assert.equal(item.tone, 'success');
});

test('bug maps category, page and first line of description', () => {
  const item = bugToHistoryItem({
    id: 'b1',
    category: 'suggestion',
    description: 'Ajouter un filtre pluie\nMerci',
    page: 'map',
    status: 'open',
    created_at: '2026-09-01T14:00:00.000Z',
  });
  assert.equal(item.kind, 'bug');
  assert.equal(item.title, 'Ajouter un filtre pluie');
  assert.equal(item.subtitle, 'Amélioration · Carte');
  assert.equal(item.statusLabel, 'Ouvert');
  assert.equal(item.href, null);
});

test('history cache is fresh for 20 seconds then expires', () => {
  assert.equal(isSuggestionHistoryCacheFresh(1_000, 1_000 + 19_999), true);
  assert.equal(isSuggestionHistoryCacheFresh(1_000, 1_000 + 20_000), false);
});

test('merge sorts newest first and filter keeps a single kind', () => {
  const event = eventSuggestToHistoryItem({
    id: 'e',
    title: 'A',
    status: 'pending',
    created_at: '2026-09-01T10:00:00.000Z',
  });
  const bug = bugToHistoryItem({
    id: 'b',
    category: 'bug',
    description: 'Crash',
    page: 'home',
    status: 'done',
    created_at: '2026-09-02T10:00:00.000Z',
  });
  const merged = mergeSuggestionHistory([event, bug]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ['bug:b', 'event:e'],
  );
  assert.deepEqual(
    filterSuggestionHistory(merged, 'bug').map((item) => item.id),
    ['bug:b'],
  );
});
