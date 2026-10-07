import test from 'node:test';
import assert from 'node:assert/strict';
import { likersVisibleToViewer, mutualFriendIds, orderLikersFriendsFirst } from './event-likers';

test('mutual friends are people followed who follow back, listed before other likers', () => {
  const friends = mutualFriendIds(['lea', 'sam', 'noa'], ['lea', 'sam', 'kim']);
  assert.deepEqual([...friends].sort(), ['lea', 'sam']);

  const ordered = orderLikersFriendsFirst(
    [
      { id: 'noa', display_name: 'Noa' },
      { id: 'lea', display_name: 'Léa' },
      { id: 'kim', display_name: 'Kim' },
      { id: 'sam', display_name: 'Sam' },
    ],
    friends,
  );
  assert.deepEqual(
    ordered.map((row) => [row.id, row.isFriend]),
    [
      ['lea', true],
      ['sam', true],
      ['noa', false],
      ['kim', false],
    ],
  );
});

test('a one-way follow is hidden from the liker list', () => {
  const visible = likersVisibleToViewer(
    [
      { id: 'noa' },
      { id: 'lea' },
      { id: 'kim' },
    ],
    ['lea', 'noa'],
    ['lea'],
  );
  assert.deepEqual(
    visible.map((row) => [row.id, row.isFriend]),
    [
      ['lea', true],
      ['kim', false],
    ],
  );
});
