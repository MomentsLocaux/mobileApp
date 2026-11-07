import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { installWebCrypto } from './webcrypto';

describe('installWebCrypto', () => {
  it('adds getRandomValues when crypto exists without it', async () => {
    const previous = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
      writable: true,
    });

    try {
      installWebCrypto();
      const bytes = new Uint8Array(16);
      const returned = globalThis.crypto.getRandomValues(bytes);
      assert.equal(returned, bytes);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
      assert.equal(
        Buffer.from(digest).toString('hex'),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: previous,
        configurable: true,
        writable: true,
      });
    }
  });
});
