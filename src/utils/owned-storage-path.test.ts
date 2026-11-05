import assert from 'node:assert/strict';
import test from 'node:test';
import { isOwnedAccountStoragePath } from './owned-storage-path';

const me = '8fa10d11-4a18-4913-acd9-b4937fdf374c';
const other = 'b5b5e6c1-4794-4d1c-bba8-38b5b5007338';

test('keeps only files inside the account folders', () => {
  assert.equal(isOwnedAccountStoragePath('avatar', `avatars/${me}/a.jpg`, me), true);
  assert.equal(isOwnedAccountStoragePath('avatar', `profile-covers/${me}/a.jpg`, me), true);
  assert.equal(isOwnedAccountStoragePath('event-media', `event-covers/${me}/a.png`, me), true);
  assert.equal(isOwnedAccountStoragePath('event-media', `gallery/${me}/a.jpg`, me), true);
  assert.equal(isOwnedAccountStoragePath('event-media', `contrib/${other}/${me}/a.jpg`, me), true);
  assert.equal(isOwnedAccountStoragePath('account-exports', `${me}/export.json`, me), true);
  assert.equal(isOwnedAccountStoragePath('bug-report-attachments', `${me}/file.png`, me), true);
});

test('refuses another account, a default image, and a crafted path', () => {
  assert.equal(isOwnedAccountStoragePath('avatar', `avatars/${other}/a.jpg`, me), false);
  assert.equal(isOwnedAccountStoragePath('event-media', 'category-defaults/music.jpg', me), false);
  assert.equal(isOwnedAccountStoragePath('event-media', `event-covers/${me}`, me), false);
  assert.equal(isOwnedAccountStoragePath('avatar', `avatars/${me}/../${other}/a.jpg`, me), false);
  assert.equal(isOwnedAccountStoragePath('public', `avatars/${me}/a.jpg`, me), false);
  assert.equal(isOwnedAccountStoragePath('avatar', `avatars/${me}/a.jpg`, 'not-a-uuid'), false);
});
