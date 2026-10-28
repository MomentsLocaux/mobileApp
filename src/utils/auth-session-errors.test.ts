import test from 'node:test';
import assert from 'node:assert/strict';
import { isRevokedRefreshToken } from './auth-session-errors';

test('revoked refresh tokens are discarded', () => {
  assert.equal(isRevokedRefreshToken({ code: 'refresh_token_not_found', message: '' }), true);
  assert.equal(isRevokedRefreshToken({ message: 'Invalid Refresh Token' }), true);
  assert.equal(isRevokedRefreshToken({ message: 'Refresh Token Not Found' }), true);
  assert.equal(
    isRevokedRefreshToken({ message: 'refresh token has already been used' }),
    true,
  );
});

test('network failures keep the stored session', () => {
  assert.equal(isRevokedRefreshToken({ message: 'Network request failed' }), false);
  assert.equal(isRevokedRefreshToken({ message: 'Failed to fetch' }), false);
  assert.equal(isRevokedRefreshToken(null), false);
});
