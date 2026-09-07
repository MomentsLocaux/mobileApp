import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isQueryTimeoutError } from './query-timeout';

describe('isQueryTimeoutError', () => {
  it('detects Postgres statement timeout code 57014', () => {
    assert.equal(isQueryTimeoutError({ code: '57014', message: 'canceling statement' }), true);
  });

  it('detects wrapped provider messages', () => {
    assert.equal(
      isQueryTimeoutError(
        new Error('[listEvents] canceling statement due to statement timeout (57014)')
      ),
      true
    );
  });

  it('detects the map viewport client race timeout', () => {
    assert.equal(
      isQueryTimeoutError(Object.assign(new Error('list_map_viewport client timeout'), { code: '57014' })),
      true
    );
  });

  it('ignores generic network failures', () => {
    assert.equal(isQueryTimeoutError(new Error('Network request failed')), false);
    assert.equal(isQueryTimeoutError(new Error('Supabase ne répond pas (timeout). Réessayez.')), false);
  });
});
