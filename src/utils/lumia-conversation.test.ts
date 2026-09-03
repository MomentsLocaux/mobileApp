import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeLumiaSearchText,
  isLumiaFollowUp,
  isLumiaNearMeQuery,
  toLumiaEdgeHistory,
} from './lumia-conversation';

describe('isLumiaFollowUp', () => {
  it('detects relances temporelles et locatives', () => {
    assert.equal(isLumiaFollowUp('et demain ?'), true);
    assert.equal(isLumiaFollowUp('à Nancy'), true);
    assert.equal(isLumiaFollowUp('aussi à Metz'), true);
  });

  it('does not treat a full new query as a follow-up', () => {
    assert.equal(isLumiaFollowUp('concert jazz à Lyon demain'), false);
  });
});

describe('composeLumiaSearchText', () => {
  it('merges the last user turns into a follow-up', () => {
    const composed = composeLumiaSearchText('et demain', [
      { role: 'user', text: 'concert à Metz' },
      { role: 'lumia', text: 'Voici 2 concerts.' },
    ]);
    assert.equal(composed, 'concert à Metz et demain');
  });

  it('keeps a standalone query unchanged', () => {
    assert.equal(composeLumiaSearchText('brocante à Fontoy', []), 'brocante à Fontoy');
  });
});

describe('isLumiaNearMeQuery', () => {
  it('detects près de moi', () => {
    assert.equal(isLumiaNearMeQuery('quels événements près de moi'), true);
    assert.equal(isLumiaNearMeQuery('concert à Paris'), false);
  });
});

describe('toLumiaEdgeHistory', () => {
  it('maps lumia turns to assistant and truncates', () => {
    const turns = toLumiaEdgeHistory([
      { role: 'user', text: 'carte' },
      { role: 'lumia', text: 'Ouvre l’onglet Carte.' },
    ]);
    assert.deepEqual(turns, [
      { role: 'user', text: 'carte' },
      { role: 'assistant', text: 'Ouvre l’onglet Carte.' },
    ]);
  });
});
