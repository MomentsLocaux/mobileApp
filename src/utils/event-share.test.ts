import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppShareMessage,
  getEventShareMessage,
  internalEventShareMessage,
  parseSharedEventMessage,
  sharedEventInboxPreview,
} from './event-share-message';

const eventId = '43e8248c-24d5-4811-a2a4-615e396c37d4';

test('an internal share opens with a hook, then the moment', () => {
  assert.equal(
    internalEventShareMessage('  Cosy Autumn  ', eventId),
    `Je pense que cet événement pourrait t’intéresser.\nCosy Autumn\nmoments-locaux://events/${eventId}`,
  );
});

test('a shared message becomes a moment card under the hook', () => {
  const body = internalEventShareMessage('Cosy Autumn', eventId);
  assert.deepEqual(parseSharedEventMessage(body), {
    eventId,
    title: 'Cosy Autumn',
    note: 'Je pense que cet événement pourrait t’intéresser.',
  });
  assert.equal(sharedEventInboxPreview(body), 'Je pense que cet événement pourrait t’intéresser.');
});

test('a share without a hook still shows the moment title', () => {
  const body = `Cosy Autumn\nmoments-locaux://events/${eventId}`;
  assert.deepEqual(parseSharedEventMessage(body), { eventId, title: 'Cosy Autumn', note: '' });
  assert.equal(sharedEventInboxPreview(body), 'Moment : Cosy Autumn');
});

test('an external event share is one sentence and one web link', () => {
  const message = getEventShareMessage('  Cosy Autumn  ', eventId);
  assert.equal(
    message,
    `Je te partage « Cosy Autumn » sur Moments Locaux.\nhttps://www.moments-locaux.com/fr/events/${eventId}`,
  );
  assert.equal(message.includes('moments-locaux://'), false);
});

test('an app invite keeps the link on its own line', () => {
  assert.equal(
    getAppShareMessage('https://www.moments-locaux.com'),
    'Viens découvrir Moments Locaux avec moi.\nhttps://www.moments-locaux.com',
  );
});

test('a plain message stays text', () => {
  assert.equal(parseSharedEventMessage('On se retrouve là ?'), null);
  assert.equal(sharedEventInboxPreview('On se retrouve là ?'), null);
});
