import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findPublicSecretProblems } from './check-client-secrets.mjs';

describe('SEC-003 public secret scanner', () => {
  it('allows the documented public env names', () => {
    assert.deepEqual(
      findPublicSecretProblems({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJub25lIn0.e30.',
        EXPO_PUBLIC_MAPBOX_TOKEN: 'pk.public-token',
      }),
      [],
    );
  });

  it('rejects denylist names and secret shapes on public prefixes', () => {
    const problems = findPublicSecretProblems({
      EXPO_PUBLIC_OPENAI_API_KEY: 'sk-abcdefghijklmnopqrstuvwxyz',
      EXPO_PUBLIC_MAPBOX_TOKEN: 'sk.abcdefghijklmnopqrstuvwxyz',
      NEXT_PUBLIC_SERVICE_ROLE: 'not-a-jwt',
    });
    assert.ok(problems.some((row) => row.includes('OPENAI_API_KEY') || row.includes('secret shape')));
    assert.ok(problems.some((row) => row.includes('NEXT_PUBLIC_SERVICE_ROLE') || row.includes('looks like a secret')));
  });
});
