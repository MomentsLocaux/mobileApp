import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGN_OUT_CHOICE, signOutModeForChoice } from '../constants/sign-out-choice';

test('logout choices are not account deletion', () => {
  assert.match(SIGN_OUT_CHOICE.message, /n’est pas supprimé/);
  assert.doesNotMatch(SIGN_OUT_CHOICE.keepDevice, /supprim/i);
  assert.doesNotMatch(SIGN_OUT_CHOICE.forgetDevice, /supprim/i);
});

test('keep-device stays a soft session, forget-device is a full local purge', () => {
  assert.equal(signOutModeForChoice('keep-device'), 'soft');
  assert.equal(signOutModeForChoice('forget-device'), 'full');
});

test('labels stay everyday language', () => {
  assert.equal(SIGN_OUT_CHOICE.keepDevice, 'Garder cet appareil');
  assert.equal(SIGN_OUT_CHOICE.forgetDevice, 'Oublier cet appareil');
  assert.doesNotMatch(SIGN_OUT_CHOICE.message, /token|SecureStore|fullSignOut|soft/i);
});
