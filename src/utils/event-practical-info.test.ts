import test from 'node:test';
import assert from 'node:assert/strict';
import { practicalInfoFromDraft } from './event-practical-info';

test('an empty price is a free event', () => {
  assert.deepEqual(practicalInfoFromDraft(undefined, undefined), {
    isFree: true,
    price: null,
    contactEmail: null,
    contactPhone: null,
  });
});

test('a typed amount is kept and a poster contact line is split', () => {
  assert.deepEqual(practicalInfoFromDraft('12,5', 'orga@exemple.fr · 06 12 34 56 78'), {
    isFree: false,
    price: 12.5,
    contactEmail: 'orga@exemple.fr',
    contactPhone: '06 12 34 56 78',
  });
});

test('a free poster (price 0) does not store a paid amount', () => {
  assert.deepEqual(practicalInfoFromDraft('0', '06 00 00 00 00'), {
    isFree: true,
    price: null,
    contactEmail: null,
    contactPhone: '06 00 00 00 00',
  });
});
