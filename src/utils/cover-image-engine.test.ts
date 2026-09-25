import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectCoverImageEngine } from './cover-image-engine';

describe('detectCoverImageEngine', () => {
  it('uses expo-image when the JS module exports Image', () => {
    assert.equal(
      detectCoverImageEngine(() => ({ Image: function ExpoImage() {} })),
      'expo-image',
    );
  });

  it('falls back when require throws because the native module is missing', () => {
    assert.equal(
      detectCoverImageEngine(() => {
        throw new Error("Cannot find native module 'ExpoImage'");
      }),
      'react-native',
    );
  });

  it('falls back when NativeModules.ExpoImage is absent but require still returns empty', () => {
    assert.equal(detectCoverImageEngine(() => ({})), 'react-native');
    assert.equal(detectCoverImageEngine(() => null), 'react-native');
  });
});
