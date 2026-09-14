import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertAppStorageBucket, CONTEST_MEDIA_BUCKET } from './storage-buckets';

describe('assertAppStorageBucket', () => {
  it('allows Alpha buckets', () => {
    assert.doesNotThrow(() => assertAppStorageBucket('event-media', false));
    assert.doesNotThrow(() => assertAppStorageBucket('avatar', false));
  });

  it('blocks contest-media when the feature flag is off', () => {
    assert.throws(
      () => assertAppStorageBucket(CONTEST_MEDIA_BUCKET, false),
      /Contest storage is disabled/,
    );
  });

  it('allows contest-media when contests are on', () => {
    assert.doesNotThrow(() => assertAppStorageBucket(CONTEST_MEDIA_BUCKET, true));
  });
});
