import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEventOrganizerOwner,
  isPlatformOrganizerEvent,
  publicOrganizerMeta,
  publicOrganizerName,
  shouldUseCreatorOrganizerAvatar,
} from './event-organizer';

test('community suggest is published as Moments Locaux, not the suggester', () => {
  const event = {
    creator_id: 'user-1',
    submission_source: 'community_suggest',
    creator: { display_name: 'Léa', avatar_url: 'https://example.com/lea.png' },
  };
  assert.equal(isPlatformOrganizerEvent(event), true);
  assert.equal(isEventOrganizerOwner('user-1', event), false);
  assert.equal(publicOrganizerName(event), 'Moments Locaux');
  assert.equal(publicOrganizerMeta(event), 'Proposé par un membre');
  assert.equal(shouldUseCreatorOrganizerAvatar(event), false);
});

test('organizer create keeps the creator as owner and public name', () => {
  const event = {
    creator_id: 'user-1',
    submission_source: 'organizer_create',
    creator: { display_name: 'Léa', avatar_url: 'https://example.com/lea.png' },
  };
  assert.equal(isPlatformOrganizerEvent(event), false);
  assert.equal(isEventOrganizerOwner('user-1', event), true);
  assert.equal(isEventOrganizerOwner('user-2', event), false);
  assert.equal(publicOrganizerName(event), 'Léa');
  assert.equal(publicOrganizerMeta(event), null);
  assert.equal(shouldUseCreatorOrganizerAvatar(event), true);
});

test('imported agenda without a real organizer falls back to Moments Locaux', () => {
  const event = {
    creator_id: 'platform',
    submission_source: 'organizer_create',
    creator: { display_name: 'Moments Locaux', avatar_url: null },
  };
  assert.equal(isPlatformOrganizerEvent(event), true);
  assert.equal(publicOrganizerMeta(event), 'Agenda public');
  assert.equal(shouldUseCreatorOrganizerAvatar(event), false);
});
