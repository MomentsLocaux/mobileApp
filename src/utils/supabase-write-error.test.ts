import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapSupabaseWriteError } from './supabase-write-error';

describe('mapSupabaseWriteError', () => {
  it('maps the chr(0) trigger failure to a short sentence', () => {
    assert.equal(
      mapSupabaseWriteError({ message: 'null character not permitted', code: '54000' }),
      "Impossible d'envoyer ce texte pour le moment."
    );
  });

  it('maps rate-limit and length errors', () => {
    assert.equal(
      mapSupabaseWriteError({ message: 'RATE_LIMIT_EXCEEDED' }),
      'Trop de requêtes. Réessaie dans une minute.'
    );
    assert.equal(
      mapSupabaseWriteError({ message: 'UGC_TOO_LONG' }),
      'Texte trop long. Raccourcis-le puis réessaie.'
    );
  });

  it('leaves unknown errors to the caller', () => {
    assert.equal(mapSupabaseWriteError({ message: 'JWT expired', code: 'PGRST301' }), null);
  });
});
