import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DISCOVERY_DEFAULT_RADIUS_KM } from '../constants/filters';
import { useDiscoveryFiltersStore } from './discoveryFiltersStore';

describe('discovery filter store', () => {
  beforeEach(() => {
    useDiscoveryFiltersStore.getState().reset();
  });

  it('keeps status and search criteria cumulative', () => {
    const store = useDiscoveryFiltersStore.getState();
    store.setContent({ categories: ['music'] });
    store.commitSearch();
    store.setStatus('upcoming');

    const current = useDiscoveryFiltersStore.getState();
    assert.equal(current.status, 'upcoming');
    assert.deepEqual(current.content.categories, ['music']);
    assert.equal(current.searchApplied, true);
  });

  it('resolves past status against future date criteria', () => {
    const store = useDiscoveryFiltersStore.getState();
    store.setWhen({ preset: 'tomorrow' });
    store.setStatus('past');

    const current = useDiscoveryFiltersStore.getState();
    assert.equal(current.status, 'past');
    assert.deepEqual(current.when, { includePast: false });
  });

  it('clears search criteria without changing status or presentation', () => {
    const store = useDiscoveryFiltersStore.getState();
    store.setStatus('live');
    store.setPlace({
      center: { latitude: 49.61, longitude: 6.13 },
      label: 'Luxembourg',
      radiusKm: 25,
    });
    store.setSort('map', 'distance');
    store.setMapMode('satellite');
    store.commitSearch();

    store.clearSearchCriteria();

    const current = useDiscoveryFiltersStore.getState();
    assert.equal(current.status, 'live');
    assert.deepEqual(current.place, {
      center: null,
      radiusKm: DISCOVERY_DEFAULT_RADIUS_KM,
    });
    assert.deepEqual(current.sort.map, { sortBy: 'distance', sortOrder: undefined });
    assert.equal(current.mapMode, 'satellite');
    assert.equal(current.searchApplied, false);
  });

  it('resets all criteria while preserving each surface preference', () => {
    const store = useDiscoveryFiltersStore.getState();
    store.setStatus('upcoming');
    store.setContent({ tags: ['family'] });
    store.setSort('home', 'date', 'asc');
    store.setSort('map', 'popularity', 'desc');
    store.setMapMode('satellite');

    store.resetCriteria();

    const current = useDiscoveryFiltersStore.getState();
    assert.equal(current.status, 'live');
    assert.deepEqual(current.content.tags, []);
    assert.deepEqual(current.sort.home, { sortBy: 'date', sortOrder: 'asc' });
    assert.deepEqual(current.sort.map, { sortBy: 'popularity', sortOrder: 'desc' });
    assert.equal(current.mapMode, 'satellite');
  });

  it('removes one recent place without clearing the others', () => {
    const store = useDiscoveryFiltersStore.getState();
    store.addPlaceHistory('Luxembourg');
    store.addPlaceHistory('Metz');

    store.removePlaceHistory('Luxembourg');

    assert.deepEqual(useDiscoveryFiltersStore.getState().placeHistory, ['Metz']);
  });

  it('publishes search criteria and presentation in one atomic update', () => {
    const beforeRevision = useDiscoveryFiltersStore.getState().searchRevision;
    let updates = 0;
    const unsubscribe = useDiscoveryFiltersStore.subscribe(() => {
      updates += 1;
    });

    const committed = useDiscoveryFiltersStore.getState().applySearchCriteria(
      {
        when: { preset: 'tomorrow' },
        place: {
          center: { latitude: 49.61, longitude: 6.13 },
          label: 'Luxembourg',
          radiusKm: 20,
        },
        content: {
          categories: ['music'],
          subcategories: ['concert'],
          tags: ['legacy-hidden-filter'],
          query: 'jazz',
        },
      },
      {
        status: 'all',
        surface: 'map',
        sort: { sortBy: 'date', sortOrder: 'asc' },
        applied: true,
      }
    );
    unsubscribe();

    const current = useDiscoveryFiltersStore.getState();
    assert.equal(updates, 1);
    assert.equal(current.searchRevision, beforeRevision + 1);
    assert.equal(current.searchApplied, true);
    assert.equal(current.status, 'all');
    assert.deepEqual(current.content.tags, []);
    assert.deepEqual(current.sort.map, { sortBy: 'date', sortOrder: 'asc' });
    assert.deepEqual(committed.content, current.content);
  });
});
