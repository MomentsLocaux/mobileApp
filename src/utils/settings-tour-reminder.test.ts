import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_TOUR_COPY, settingsTourFireAt } from './settings-tour-reminder';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute, 0);

test('the copy stays short enough for a lock screen', () => {
  assert.ok(SETTINGS_TOUR_COPY.title.length <= 40);
  assert.ok(SETTINGS_TOUR_COPY.body.length <= 120);
  assert.match(SETTINGS_TOUR_COPY.title, /ne rien rater/);
  assert.match(SETTINGS_TOUR_COPY.body, /personnaliser ton expérience/);
});

test('a daytime install is reminded at 10:00 the next morning', () => {
  const fire = settingsTourFireAt(at(7, 15, 30), at(7, 16));
  assert.equal(fire?.getDate(), 8);
  assert.equal(fire?.getHours(), 10);
  assert.equal(fire?.getMinutes(), 0);
});

test('an early-morning install still waits until the next day', () => {
  const fire = settingsTourFireAt(at(7, 9), at(7, 9, 5));
  assert.equal(fire?.getDate(), 8);
  assert.equal(fire?.getHours(), 10);
});

test('a missed morning is caught up once during the day', () => {
  const fire = settingsTourFireAt(at(7, 15), at(8, 11));
  assert.equal(fire?.getTime(), at(8, 11).getTime() + 60_000);
});

test('a missed night waits for the following morning, then stops', () => {
  const sameNight = settingsTourFireAt(at(7, 15), at(8, 22, 30));
  assert.equal(sameNight?.getDate(), 9);
  assert.equal(sameNight?.getHours(), 10);

  assert.equal(settingsTourFireAt(at(1, 12), at(7, 12)), null);
});
