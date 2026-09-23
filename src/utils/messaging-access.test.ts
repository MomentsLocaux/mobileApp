import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areFriends,
  canMessageProfile,
  messagingBlockedCopy,
  normalizeProfileVisibility,
} from './messaging-access';

test('a friend is a mutual follow', () => {
  assert.equal(areFriends(true, true), true);
  assert.equal(areFriends(true, false), false);
  assert.equal(areFriends(false, true), false);
});

test('public profiles can be messaged without being friends', () => {
  const access = canMessageProfile({
    viewerId: 'me',
    targetId: 'you',
    visibility: 'public',
    viewerFollowsTarget: false,
    targetFollowsViewer: false,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.reason, 'ok');
});

test('private profiles require a mutual follow', () => {
  const blocked = canMessageProfile({
    viewerId: 'me',
    targetId: 'you',
    visibility: 'private',
    viewerFollowsTarget: true,
    targetFollowsViewer: false,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'private_need_friend');

  const allowed = canMessageProfile({
    viewerId: 'me',
    targetId: 'you',
    visibility: 'private',
    viewerFollowsTarget: true,
    targetFollowsViewer: true,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.isFriend, true);
});

test('unknown visibility defaults to public', () => {
  assert.equal(normalizeProfileVisibility(undefined), 'public');
  assert.equal(normalizeProfileVisibility('private'), 'private');
  assert.match(messagingBlockedCopy({ firstName: 'Léa', viewerFollowsTarget: false }), /privé/);
});
