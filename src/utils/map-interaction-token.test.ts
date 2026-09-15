import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consumeBooleanFlag } from './map-interaction-token';

describe('map interaction token', () => {
  it('consumes a one-shot flag and ignores the next read', () => {
    const flag = { current: true };
    assert.equal(consumeBooleanFlag(flag), true);
    assert.equal(flag.current, false);
    assert.equal(consumeBooleanFlag(flag), false);
  });
});
