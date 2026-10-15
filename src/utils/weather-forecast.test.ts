import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  messageForWeatherPlan,
  openMeteoForecastUrl,
  parseOpenMeteoForecast,
  planEventWeather,
  weatherKindFromCode,
} from './weather-forecast';

const now = new Date('2026-10-09T10:00:00.000Z');

describe('event weather forecast', () => {
  it('maps WMO codes to a short French condition', () => {
    assert.equal(weatherKindFromCode(0), 'clear');
    assert.equal(weatherKindFromCode(3), 'cloudy');
    assert.equal(weatherKindFromCode(63), 'rain');
    assert.equal(weatherKindFromCode(95), 'thunder');
    assert.equal(weatherKindFromCode(null), 'unknown');
  });

  it('skips past events and events beyond the 16-day horizon', () => {
    assert.equal(
      planEventWeather({ startsAt: '2026-10-01T18:00:00.000Z', endsAt: '2026-10-01T20:00:00.000Z', now }).status,
      'past',
    );
    const far = planEventWeather({
      startsAt: '2026-12-01T18:00:00.000Z',
      endsAt: '2026-12-01T20:00:00.000Z',
      now,
    });
    assert.equal(far.status, 'too_far');
    if (far.status === 'too_far') {
      assert.match(messageForWeatherPlan(far), /16 jours/);
    }
  });

  it('asks for a three-day strip starting on a one-day event', () => {
    const plan = planEventWeather({
      startsAt: '2026-10-10T16:00:00.000Z',
      endsAt: '2026-10-10T20:00:00.000Z',
      now,
    });
    assert.deepEqual(plan, {
      status: 'fetch',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
      truncated: false,
    });
  });

  it('fetches from today when an event is already underway', () => {
    const plan = planEventWeather({
      startsAt: '2026-10-08T18:00:00.000Z',
      endsAt: '2026-10-11T18:00:00.000Z',
      now,
    });
    assert.deepEqual(plan, {
      status: 'fetch',
      startDate: '2026-10-09',
      endDate: '2026-10-11',
      truncated: false,
    });
  });

  it('builds an Open-Meteo URL and reads the hour of the event', () => {
    const url = openMeteoForecastUrl({
      latitude: 49.12,
      longitude: 6.17,
      startDate: '2026-10-10',
      endDate: '2026-10-10',
    });
    assert.match(url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
    assert.match(url, /latitude=49\.12/);
    assert.match(url, /timezone=Europe%2FParis/);

    const view = parseOpenMeteoForecast({
      startsAt: '2026-10-10T16:00:00.000Z',
      truncated: false,
      payload: {
        daily: {
          time: ['2026-10-10'],
          weather_code: [2],
          temperature_2m_max: [19.4],
          temperature_2m_min: [11.2],
          precipitation_probability_max: [20],
        },
        hourly: {
          time: ['2026-10-10T18:00'],
          temperature_2m: [16.2],
          precipitation_probability: [10],
          weather_code: [1],
        },
      },
    });
    assert.equal(view.status, 'ready');
    if (view.status === 'ready') {
      assert.match(view.headline, /16°/);
      assert.match(view.headline, /Ciel dégagé/);
      assert.match(view.caption, /Peu de pluie/);
      assert.equal(view.days[0]?.weekday, 'SAM');
      assert.equal(view.days[0]?.dayNumber, '10');
      assert.equal(view.days.length, 1);
    }
  });
});
