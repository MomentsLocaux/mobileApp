import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeSignInError } from './auth-error-message';

test('supabase invalid login credentials become a french message', () => {
  const error = Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' });
  assert.equal(localizeSignInError(error), 'Email ou mot de passe incorrect');
  assert.equal(
    localizeSignInError(new Error('Invalid login credential')),
    'Email ou mot de passe incorrect',
  );
});

test('other sign-in errors keep their message', () => {
  assert.equal(localizeSignInError(new Error('Email not confirmed')), 'Email not confirmed');
  assert.equal(localizeSignInError(null, 'Connexion impossible'), 'Connexion impossible');
});
