import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCityDistanceLine,
  formatIntroPlace,
  formatPeerLikeLabel,
  formatPlaceDrawerLines,
  formatPlaceMeta,
} from './event-detail-presentation';

test('peer likes name the first friend and count the rest', () => {
  assert.equal(formatPeerLikeLabel([]), null);
  assert.equal(formatPeerLikeLabel(['  Léa Martin  ']), 'Aimé par Léa');
  assert.equal(formatPeerLikeLabel(['Léa', 'Marc']), 'Aimé par Léa et 1 ami');
  assert.equal(formatPeerLikeLabel(['Léa', 'Marc', 'Noa']), 'Aimé par Léa et 2 amis');
});

test('the intro place keeps a known venue and distance, and skips a missing place', () => {
  assert.equal(formatIntroPlace('La Manufacture', '2,4 km'), 'La Manufacture · à 2,4 km');
  assert.equal(formatIntroPlace('Lieu à venir', null), '');
  assert.equal(formatIntroPlace('Luxembourg', null), 'Luxembourg');
});

test('the closed place row keeps only the city and the distance', () => {
  assert.equal(formatCityDistanceLine('Hagondange', '17,6 km'), 'Hagondange · à 17,6 km');
  assert.equal(formatCityDistanceLine('  ', '2 km'), 'à 2 km');
  assert.equal(formatCityDistanceLine(null, null), '');
});

test('a venue that is only the street number is not repeated above the address', () => {
  assert.deepEqual(
    formatPlaceDrawerLines({
      venue: '1',
      address: '1 Rue Général de Castelnau\n57240',
      postalCode: null,
      city: 'Nilvange',
    }),
    ['1 Rue Général de Castelnau\n57240'],
  );
  assert.deepEqual(
    formatPlaceDrawerLines({
      venue: '1',
      address: '10 rue des Halles',
      postalCode: '57300',
      city: 'Hagondange',
    }),
    ['1', '10 rue des Halles', '57300 Hagondange'],
  );
});

test('the place drawer keeps the venue and the address, not the city alone', () => {
  assert.deepEqual(
    formatPlaceDrawerLines({
      venue: 'Zone du BUNER',
      address: '',
      postalCode: '57300',
      city: 'Hagondange',
    }),
    ['Zone du BUNER', '57300 Hagondange'],
  );
  assert.deepEqual(
    formatPlaceDrawerLines({
      venue: 'Hagondange',
      address: '12 rue des Halles, 57300 Hagondange',
      postalCode: '57300',
      city: 'Hagondange',
    }),
    ['12 rue des Halles, 57300 Hagondange'],
  );
  assert.deepEqual(formatPlaceDrawerLines({ city: 'Hagondange' }), []);
});

test('the place meta does not repeat the venue', () => {
  assert.equal(
    formatPlaceMeta('La Manufacture', '1234 Luxembourg', '2,4 km'),
    '1234 Luxembourg · à 2,4 km',
  );
  assert.equal(formatPlaceMeta('Luxembourg', 'Luxembourg', '800 m'), 'à 800 m');
  assert.equal(formatPlaceMeta('Luxembourg', 'Lieu de l’événement', null), '');
});
