import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_PRESETS,
  encodePresetAvatarUrl,
  getAvatarPreset,
  hasRenderableAvatar,
  isPresetAvatarUrl,
  isRemoteAvatarUrl,
  parsePresetAvatarId,
} from '../constants/avatar-presets';

test('avatar preset pack has 20 unique ids', () => {
  assert.equal(AVATAR_PRESETS.length, 20);
  assert.equal(new Set(AVATAR_PRESETS.map((preset) => preset.id)).size, 20);
});

test('preset urls round-trip through avatar_url helpers', () => {
  const url = encodePresetAvatarUrl('sauge');
  assert.equal(url, 'preset:sauge');
  assert.equal(parsePresetAvatarId(url), 'sauge');
  assert.equal(isPresetAvatarUrl(url), true);
  assert.equal(getAvatarPreset(url)?.id, 'sauge');
  assert.equal(hasRenderableAvatar(url), true);
  assert.equal(isRemoteAvatarUrl(url), false);
});

test('unknown or empty preset urls are not renderable presets', () => {
  assert.equal(isPresetAvatarUrl('preset:unknown'), false);
  assert.equal(isPresetAvatarUrl(''), false);
  assert.equal(isPresetAvatarUrl(null), false);
  assert.equal(parsePresetAvatarId('https://cdn.example/a.png'), null);
});

test('photo avatar urls stay remote', () => {
  assert.equal(isRemoteAvatarUrl('https://example.com/a.jpg'), true);
  assert.equal(isRemoteAvatarUrl('file:///tmp/a.jpg'), true);
  assert.equal(hasRenderableAvatar('https://example.com/a.jpg'), true);
  assert.equal(isPresetAvatarUrl('https://example.com/a.jpg'), false);
});
