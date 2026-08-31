import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  eventMatchesNameQuery,
  nameQueryOrFilters,
  sanitizeIlikeFragment,
  tokenizeNameQuery,
} from './event-name-search';

describe('event name search', () => {
  it('strips PostgREST-breaking characters from ilike fragments', () => {
    assert.equal(sanitizeIlikeFragment('marché, %concert_ (expo)'), 'marché concert expo');
  });

  it('drops French stop words and keeps significant tokens', () => {
    assert.deepEqual(tokenizeNameQuery('le marché de Noël'), ['marché', 'noël']);
  });

  it('matches when every token is in the title', () => {
    const event = { title: 'Grand marché de Noël de Metz' };
    assert.equal(eventMatchesNameQuery(event, 'marché noël'), true);
    assert.equal(eventMatchesNameQuery(event, 'concert jazz'), false);
  });

  it('matches a Ctrl+F hit in the description even if the title does not contain it', () => {
    const event = {
      title: 'Soirée au Hangar',
      description: 'Concert jazz live avec invités',
    };
    assert.equal(eventMatchesNameQuery(event, 'jazz'), true);
    assert.equal(eventMatchesNameQuery(event, 'Hangar'), true);
    assert.equal(eventMatchesNameQuery(event, 'marché'), false);
  });

  it('matches a multi-word query split across title and description', () => {
    const event = {
      title: 'Marché de printemps',
      description: 'Animations jazz et food trucks',
    };
    assert.equal(eventMatchesNameQuery(event, 'marché jazz'), true);
  });

  it('builds one title/description or() fragment per token', () => {
    assert.deepEqual(nameQueryOrFilters('marché concert'), [
      'title.ilike.%marché%,description.ilike.%marché%',
      'title.ilike.%concert%,description.ilike.%concert%',
    ]);
  });
});
