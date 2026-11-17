import test from 'node:test';
import assert from 'node:assert/strict';
import {
  profileEditHasUnsavedChanges,
  profileLocationKey,
} from './profile-edit-changes';

const saved = {
  displayName: 'Romain',
  bio: '',
  avatarUrl: 'https://cdn.example/a.jpg',
  coverUrl: '',
  locationKey: '48.85660|2.35220|Paris',
};

test('a loaded profile with no edits is not dirty', () => {
  assert.equal(profileEditHasUnsavedChanges(saved, saved), false);
});

test('a changed name, photo or place is dirty', () => {
  assert.equal(
    profileEditHasUnsavedChanges({ ...saved, displayName: 'Léa' }, saved),
    true,
  );
  assert.equal(
    profileEditHasUnsavedChanges({ ...saved, avatarUrl: 'https://cdn.example/b.jpg' }, saved),
    true,
  );
  assert.equal(
    profileEditHasUnsavedChanges(
      { ...saved, locationKey: profileLocationKey({ latitude: 45.764, longitude: 4.8357, city: 'Lyon' }) },
      saved,
    ),
    true,
  );
});

test('an empty place and a missing place share the same key', () => {
  assert.equal(profileLocationKey(null), '');
});
