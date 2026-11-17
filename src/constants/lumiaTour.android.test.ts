import assert from 'node:assert/strict';
import test from 'node:test';
import { lumiaTourAndroidScrimInsets } from './lumiaTour';

const opts = { tabBarHeight: 84, headerClearance: 210 };

test('android tour scrim leaves the tab bar clear for a tab icon', () => {
  assert.deepEqual(lumiaTourAndroidScrimInsets('map', opts), { top: 0, bottom: 84 });
});

test('android tour scrim leaves the header clear for a header icon', () => {
  assert.deepEqual(lumiaTourAndroidScrimInsets('headerNotifications', opts), {
    top: 210,
    bottom: 0,
  });
});

test('android tour scrim covers the screen when the step has no icon', () => {
  assert.deepEqual(lumiaTourAndroidScrimInsets(undefined, opts), { top: 0, bottom: 0 });
});
