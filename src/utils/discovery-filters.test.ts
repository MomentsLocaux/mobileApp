import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISCOVERY_DEFAULT_RADIUS_KM,
  NO_ACTIVE_FILTER_LABEL,
} from '../constants/filters';
import {
  activeFilterCount,
  createDefaultDiscoveryFilters,
  explainEmptyCombination,
  resetDiscoveryCriteria,
  summarize,
  toEventFilters,
  toTimeScope,
} from './discovery-filters';
import { hasSearchCriteria } from './search-helpers';

describe('discovery filter contract', () => {
  it('does not count discovery defaults as active filters', () => {
    const filters = createDefaultDiscoveryFilters();

    assert.equal(filters.status, 'all');
    assert.equal(filters.when.preset, 'today');
    assert.equal(filters.place.radiusKm, DISCOVERY_DEFAULT_RADIUS_KM);
    assert.equal(filters.place.radiusKm, 20);
    assert.deepEqual(filters.sort.home, { sortBy: 'distance', sortOrder: 'asc' });
    assert.equal(toTimeScope(filters), 'current');
    assert.equal(activeFilterCount(filters, { surface: 'home' }), 0);
    assert.equal(summarize(filters, { surface: 'home' }), NO_ACTIVE_FILTER_LABEL);
    assert.equal(
      hasSearchCriteria({
        place: filters.place,
        when: filters.when,
        content: filters.content,
      }),
      false
    );
  });

  it('counts En cours and Tous as deviations from Aujourd’hui', () => {
    const live = createDefaultDiscoveryFilters();
    live.status = 'live';
    live.when = {};
    assert.equal(activeFilterCount(live), 1);
    assert.equal(summarize(live), 'En cours');

    const all = createDefaultDiscoveryFilters();
    all.when = {};
    assert.equal(activeFilterCount(all), 1);
    assert.equal(summarize(all), 'Tous');
  });

  it('keeps presentation preferences outside the content filter count', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.mapMode = 'satellite';

    assert.equal(activeFilterCount(filters, { surface: 'map' }), 0);
    assert.equal(summarize(filters, { surface: 'map' }), NO_ACTIVE_FILTER_LABEL);
    assert.equal(summarize(filters, { surface: 'map', includeMapMode: true }), 'Satellite');
  });

  it('counts sort independently for home and map', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.sort.map = { sortBy: 'distance' };

    assert.equal(activeFilterCount(filters, { surface: 'home' }), 0);
    assert.equal(activeFilterCount(filters, { surface: 'map' }), 1);
  });

  it('counts an explicit place or a non-default radius', () => {
    const explicitPlace = createDefaultDiscoveryFilters();
    explicitPlace.place = {
      center: { latitude: 49.61, longitude: 6.13 },
      label: 'Luxembourg',
      radiusKm: DISCOVERY_DEFAULT_RADIUS_KM,
    };

    const widerRadius = createDefaultDiscoveryFilters();
    widerRadius.place.radiusKm = 25;

    assert.equal(activeFilterCount(explicitPlace), 1);
    assert.equal(activeFilterCount(widerRadius), 1);
  });

  it('summarizes every user-visible criteria axis and ignores legacy tags', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.when = { startDate: '2026-09-01', endDate: '2026-09-03' };
    filters.place = {
      center: { latitude: 49.61, longitude: 6.13 },
      label: 'Luxembourg',
      radiusKm: 25,
    };
    filters.content = {
      categories: ['music'],
      subcategories: [],
      tags: ['jazz'],
      query: 'concert',
    };
    filters.sort.map = { sortBy: 'date', sortOrder: 'asc' };

    assert.equal(
      summarize(filters, {
        surface: 'map',
        categoryLabels: { music: 'Musique' },
      }),
      '01/09–03/09 · Luxembourg · 25 km · « concert » · Musique · Date de début'
    );
    assert.equal(activeFilterCount(filters, { surface: 'map' }), 5);
  });

  it('summarizes one-sided custom date ranges', () => {
    const from = createDefaultDiscoveryFilters();
    from.when = { startDate: '2026-09-01' };

    const until = createDefaultDiscoveryFilters();
    until.when = { endDate: '2026-09-03' };

    assert.equal(summarize(from), 'Dès le 01/09');
    assert.equal(summarize(until), 'Jusqu’au 03/09');
  });

  it('summarizes a custom single day without a range dash', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.when = { startDate: '2026-09-15', endDate: '2026-09-15' };
    assert.equal(summarize(filters), '15/09');
  });

  it('prefers the custom dates over a generic include-past label', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.when = { startDate: '2026-08-01', endDate: '2026-08-02', includePast: true };
    assert.equal(summarize(filters), '01/08–02/08');
  });

  it('maps the shared contract to event query filters', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.when.preset = 'today';
    filters.place = {
      center: { latitude: 49.61, longitude: 6.13 },
      label: 'Luxembourg',
      radiusKm: 25,
    };
    filters.content = {
      categories: ['music'],
      subcategories: ['jazz'],
      tags: ['family'],
      query: ' concert ',
    };

    assert.deepEqual(toEventFilters(filters), {
      includePast: false,
      centerLat: 49.61,
      centerLon: 6.13,
      radiusKm: 25,
      time: 'today',
      categories: ['music'],
      subcategories: ['jazz'],
      name: 'concert',
    });
  });

  it('applies the default nearby radius when device coordinates are available', () => {
    const filters = createDefaultDiscoveryFilters();

    assert.deepEqual(toEventFilters(filters, { latitude: 49.61, longitude: 6.13 }), {
      includePast: false,
      time: 'today',
      centerLat: 49.61,
      centerLon: 6.13,
      radiusKm: DISCOVERY_DEFAULT_RADIUS_KM,
    });

    filters.place.radiusKm = 25;
    assert.deepEqual(toEventFilters(filters, { latitude: 49.61, longitude: 6.13 }), {
      includePast: false,
      time: 'today',
      centerLat: 49.61,
      centerLon: 6.13,
      radiusKm: 25,
    });
  });

  it('treats include-past as a visible, queryable date criterion', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.when = { includePast: true };

    assert.equal(activeFilterCount(filters), 1);
    assert.equal(summarize(filters), 'Passés inclus');
    assert.equal(toEventFilters(filters).includePast, true);
  });

  it('makes the explicit past status authoritative in event filters', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.status = 'past';

    assert.equal(toEventFilters(filters).includePast, true);
  });

  it('explains contradictory temporal criteria', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.status = 'live';
    filters.when.preset = 'tomorrow';
    assert.match(explainEmptyCombination(filters) ?? '', /En cours/);

    filters.status = 'all';
    filters.when = { startDate: '2026-09-03', endDate: '2026-09-01' };
    assert.equal(
      explainEmptyCombination(filters),
      'La date de début est postérieure à la date de fin.'
    );
  });

  it('resets criteria without changing surface presentation', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.status = 'live';
    filters.content.categories = ['music'];
    filters.sort.home = { sortBy: 'date', sortOrder: 'asc' };
    filters.mapMode = 'satellite';

    const reset = resetDiscoveryCriteria(filters);

    assert.equal(activeFilterCount(reset), 0);
    assert.equal(reset.status, 'all');
    assert.equal(reset.when.preset, 'today');
    assert.deepEqual(reset.content.categories, []);
    assert.deepEqual(reset.place, {
      center: null,
      radiusKm: DISCOVERY_DEFAULT_RADIUS_KM,
    });
    assert.deepEqual(reset.sort.home, { sortBy: 'date', sortOrder: 'asc' });
    assert.equal(reset.mapMode, 'satellite');
  });
});
