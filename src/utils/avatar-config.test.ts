import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_OPTIONS, AVATAR_COLOR_OPTIONS, DEFAULT_AVATAR_CONFIG, type AvatarConfig } from '../constants/avatar-options';
import { AVATAR_PRESETS, getEditableAvatarConfig, getIllustratedAvatar, hasRenderableAvatar, isRemoteAvatarUrl } from '../constants/avatar-presets';
import { CUSTOM_AVATAR_SCHEME, MAX_CUSTOM_AVATAR_LENGTH, createAvatarConfig, decodeCustomAvatar, encodeCustomAvatar, randomizeAvatar } from './avatar-config';

const rawUrl = (value: unknown) => CUSTOM_AVATAR_SCHEME + encodeURIComponent(JSON.stringify(value));

test('custom avatar survives persistence and reopening without losing any feature', () => {
  const config: AvatarConfig = {
    faceShape: 'heart', eyes: 'wink', mouth: 'open', nose: 'broad', ears: 'large',
    hairStyle: 'bald', facialHair: 'mustache', accessory: 'round-glasses',
    skin: '#754A33', hair: '#79609A', eyeColor: '#507EAC', shirt: '#628CAF',
    accessoryColor: '#AC83A0', bg: '#E8DEF0',
  };
  const stored = encodeCustomAvatar(config);
  assert.ok(stored.startsWith('avatar:v1:'));
  assert.ok(stored.length < MAX_CUSTOM_AVATAR_LENGTH);
  assert.deepEqual(decodeCustomAvatar(stored), config);
  assert.deepEqual(getEditableAvatarConfig(stored), config);
  assert.deepEqual(getIllustratedAvatar(stored), { ...config, id: 'custom-v1', label: 'Avatar personnalisé' });
  assert.equal(hasRenderableAvatar(stored), true);
  assert.equal(isRemoteAvatarUrl(stored), false);
});

test('all 20 legacy presets become editable without mutating their saved identity', () => {
  for (const preset of AVATAR_PRESETS) {
    const before = JSON.stringify(preset);
    const config = getEditableAvatarConfig(`preset:${preset.id}`);
    for (const key of ['hairStyle', 'eyes', 'mouth', 'facialHair', 'accessory', 'bg', 'skin', 'hair', 'shirt'] as const) {
      assert.equal(config[key], preset[key]);
    }
    assert.deepEqual(decodeCustomAvatar(encodeCustomAvatar(config)), config);
    assert.equal(getIllustratedAvatar(`preset:${preset.id}`), preset);
    config.skin = '#000000';
    assert.equal(JSON.stringify(preset), before);
  }
  assert.equal(getEditableAvatarConfig('preset:thym').accessoryColor, '#1A3329');
  assert.equal(getEditableAvatarConfig('preset:romarin').accessoryColor, '#E0B44A');
  assert.equal(getEditableAvatarConfig('preset:genet').accessoryColor, '#7CB518');
});

test('photos, empty values and unreadable versions safely initialize the default editor', () => {
  for (const value of [undefined, null, '', 'https://example.com/photo.jpg', 'preset:missing', 'avatar:v2:{}']) {
    assert.deepEqual(getEditableAvatarConfig(value), DEFAULT_AVATAR_CONFIG);
    assert.equal(decodeCustomAvatar(value), null);
  }
  assert.equal(hasRenderableAvatar('https://example.com/photo.jpg'), true);
  assert.equal(getIllustratedAvatar('https://example.com/photo.jpg'), null);
  assert.equal(hasRenderableAvatar('avatar:v2:{}'), false);
});

test('malformed or oversized payloads are rejected without attempting remote rendering', () => {
  for (const value of ['avatar:v1:%', 'avatar:v1:%E0%A4%A', 'avatar:v1:{', rawUrl(null), rawUrl([]), rawUrl(42), rawUrl({}), `avatar:v1:${'a'.repeat(MAX_CUSTOM_AVATAR_LENGTH)}`]) {
    assert.equal(decodeCustomAvatar(value), null);
    assert.equal(hasRenderableAvatar(value), false);
    assert.equal(isRemoteAvatarUrl(value), false);
  }
});

test('all style fields reject unknown and missing variants', () => {
  for (const key of Object.keys(AVATAR_OPTIONS)) {
    assert.equal(decodeCustomAvatar(rawUrl({ ...DEFAULT_AVATAR_CONFIG, [key]: 'unrecognized' })), null);
    assert.equal(decodeCustomAvatar(rawUrl({ ...DEFAULT_AVATAR_CONFIG, [key]: null })), null);
    assert.equal(decodeCustomAvatar(rawUrl({ ...DEFAULT_AVATAR_CONFIG, [key]: undefined })), null);
  }
});

test('colors only accept literal RGB; never SVG paint URLs, CSS or oversized values', () => {
  for (const key of Object.keys(AVATAR_COLOR_OPTIONS)) {
    for (const value of ['url(https://example.com/image.svg)', 'red', '#FFF', '#12345678', '#12ZZ00', 42, null, {}]) {
      assert.equal(decodeCustomAvatar(rawUrl({ ...DEFAULT_AVATAR_CONFIG, [key]: value })), null);
    }
  }
  const customRgb = { ...DEFAULT_AVATAR_CONFIG, bg: '#abcdef' };
  assert.equal(decodeCustomAvatar(rawUrl(customRgb))?.bg, '#ABCDEF');
  assert.throws(() => encodeCustomAvatar({ ...DEFAULT_AVATAR_CONFIG, bg: 'url(#external)' }));
});

test('encoding is canonical and discards extra metadata', () => {
  const config = { ...DEFAULT_AVATAR_CONFIG, id: 'preset-id', label: 'do not persist' };
  const reversed = Object.fromEntries(Object.entries(config).reverse()) as AvatarConfig;
  assert.equal(encodeCustomAvatar(reversed), encodeCustomAvatar(DEFAULT_AVATAR_CONFIG));
  assert.deepEqual(decodeCustomAvatar(rawUrl(config)), DEFAULT_AVATAR_CONFIG);
});

test('every selectable style and palette value can be saved and restored', () => {
  for (const [key, options] of Object.entries({ ...AVATAR_OPTIONS, ...AVATAR_COLOR_OPTIONS })) {
    for (const option of options) {
      const config = { ...DEFAULT_AVATAR_CONFIG, [key]: option.value };
      assert.deepEqual(decodeCustomAvatar(encodeCustomAvatar(config)), config);
    }
  }
});

test('randomized avatars use supported choices and never mutate defaults', () => {
  const original = { ...DEFAULT_AVATAR_CONFIG };
  for (let i = 0; i < 50; i++) {
    const config = randomizeAvatar();
    assert.deepEqual(decodeCustomAvatar(encodeCustomAvatar(config)), config);
    for (const [key, options] of Object.entries({ ...AVATAR_OPTIONS, ...AVATAR_COLOR_OPTIONS })) {
      assert.ok(options.some((option) => option.value === config[key as keyof AvatarConfig]));
    }
  }
  const draft = createAvatarConfig();
  draft.faceShape = 'square';
  assert.deepEqual(DEFAULT_AVATAR_CONFIG, original);
});
