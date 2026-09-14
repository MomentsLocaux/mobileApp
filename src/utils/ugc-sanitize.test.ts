import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isOversizedUgc, sanitizeUgcText, stripNullBytes, UGC_LIMITS } from './ugc-sanitize';

describe('ugc sanitize', () => {
  it('strips null bytes', () => {
    assert.equal(stripNullBytes('foo\u0000bar'), 'foobar');
  });

  it('trims and clamps to the server comment limit', () => {
    assert.equal(sanitizeUgcText('  hello  ', UGC_LIMITS.comment), 'hello');
    assert.equal(sanitizeUgcText('x'.repeat(5000), UGC_LIMITS.comment).length, UGC_LIMITS.comment);
  });

  it('flags oversized report reasons', () => {
    assert.equal(isOversizedUgc('ok', UGC_LIMITS.reportReason), false);
    assert.equal(isOversizedUgc('y'.repeat(UGC_LIMITS.reportReason + 1), UGC_LIMITS.reportReason), true);
  });
});
