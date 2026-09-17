import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countPendingFollowBacks,
  filterFollowListMembers,
  followActionLabel,
  formatFollowCircleHint,
  formatFollowCircleSummary,
  formatMemberLocation,
  formatMutualCaption,
  sortFollowListMembers,
} from './community-follows';

const lea = { user_id: 'lea', display_name: 'Léa', city: 'Nyons' };
const marc = { user_id: 'marc', display_name: 'Marc', city: 'Vaison' };
const zoé = { user_id: 'zoe', display_name: 'Zoé', city: 'Buis-les-Baronnies' };

describe('filterFollowListMembers', () => {
  it('matches name or city, ignoring case and spaces', () => {
    const members = [lea, marc, zoé];
    assert.deepEqual(filterFollowListMembers(members, '  NYONS '), [lea]);
    assert.deepEqual(filterFollowListMembers(members, 'zo'), [zoé]);
    assert.deepEqual(filterFollowListMembers(members, ''), members);
  });
});

describe('sortFollowListMembers', () => {
  it('puts follow-back opportunities first on the followers tab', () => {
    const sorted = sortFollowListMembers([lea, marc, zoé], {
      tab: 'followers',
      followingIds: ['lea'],
    });
    assert.deepEqual(
      sorted.map((row) => row.user_id),
      ['marc', 'zoe', 'lea'],
    );
  });

  it('keeps alphabetical order on the following tab', () => {
    const sorted = sortFollowListMembers([zoé, lea, marc], {
      tab: 'following',
      followingIds: ['zoe', 'lea', 'marc'],
    });
    assert.deepEqual(
      sorted.map((row) => row.user_id),
      ['lea', 'marc', 'zoe'],
    );
  });
});

describe('countPendingFollowBacks', () => {
  it('counts followers who are not followed yet', () => {
    assert.equal(countPendingFollowBacks([lea, marc, zoé], ['lea', 'zoe']), 1);
    assert.equal(countPendingFollowBacks([lea], ['lea']), 0);
  });
});

describe('formatFollowCircleSummary', () => {
  it('uses own-circle copy and search results', () => {
    assert.equal(
      formatFollowCircleSummary({
        isOwnList: true,
        tab: 'followers',
        total: 12,
        visible: 12,
        filtered: false,
      }),
      '12 personnes vous suivent',
    );
    assert.equal(
      formatFollowCircleSummary({
        isOwnList: true,
        tab: 'following',
        total: 1,
        visible: 1,
        filtered: false,
      }),
      'Vous suivez 1 personne',
    );
    assert.equal(
      formatFollowCircleSummary({
        isOwnList: false,
        tab: 'followers',
        total: 2,
        visible: 2,
        filtered: false,
      }),
      '2 abonnés',
    );
    assert.equal(
      formatFollowCircleSummary({
        isOwnList: true,
        tab: 'followers',
        total: 12,
        visible: 0,
        filtered: true,
      }),
      'Aucun résultat',
    );
  });
});

describe('formatFollowCircleHint', () => {
  it('nudges follow-back on the own followers tab', () => {
    assert.equal(
      formatFollowCircleHint({
        isOwnList: true,
        tab: 'followers',
        pendingFollowBacks: 2,
        total: 5,
      }),
      '2 personnes vous suivent sans être suivies. Suivez-les aussi pour voir leurs coups de cœur.',
    );
    assert.equal(
      formatFollowCircleHint({
        isOwnList: true,
        tab: 'followers',
        pendingFollowBacks: 0,
        total: 5,
      }),
      'Vous vous suivez mutuellement — leurs likes apparaissent près de chez vous.',
    );
    assert.equal(
      formatFollowCircleHint({
        isOwnList: false,
        tab: 'followers',
        pendingFollowBacks: 3,
        total: 3,
      }),
      null,
    );
  });
});

describe('followActionLabel', () => {
  it('uses Suivre aussi for own follow-back', () => {
    assert.equal(
      followActionLabel({ isFollowing: false, tab: 'followers', isOwnList: true }),
      'Suivre aussi',
    );
    assert.equal(
      followActionLabel({ isFollowing: true, tab: 'followers', isOwnList: true }),
      'Suivi',
    );
    assert.equal(
      followActionLabel({ isFollowing: false, tab: 'followers', isOwnList: false }),
      'Suivre',
    );
  });
});

describe('formatMemberLocation / formatMutualCaption', () => {
  it('falls back when city is missing', () => {
    assert.equal(formatMemberLocation(null), 'Ville non renseignée');
    assert.equal(formatMemberLocation('  Nyons '), 'Nyons');
    assert.equal(formatMemberLocation('Nyons', 'Drôme'), 'Nyons · Drôme');
  });

  it('flags mutual follow on the following tab', () => {
    assert.equal(
      formatMutualCaption({ isOwnList: true, tab: 'following', theyFollowYou: true }),
      'Vous suit aussi',
    );
    assert.equal(
      formatMutualCaption({ isOwnList: true, tab: 'followers', theyFollowYou: true }),
      null,
    );
  });
});
