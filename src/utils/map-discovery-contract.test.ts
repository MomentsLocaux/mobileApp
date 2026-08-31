import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DISCOVERY_DEFAULT_RADIUS_KM } from '../constants/filters';
import { createDefaultDiscoveryFilters } from './discovery-filters';
import {
  isDiscoverySearchActive,
  resolveHomeMapRadiusTarget,
  resolveMapHandoffMode,
  shouldPublishViewportToMap,
  shouldRefetchViewportOnTabFocus,
  shouldResetCriteriaOnAreaSearch,
  shouldApplyWhenFilters,
  shouldApplyPendingHomeRecadrage,
  resolveMapClientFilters,
  resolvePendingProgrammaticRefresh,
} from './map-discovery-contract';

describe('map discovery contract', () => {
  it('treats search as active only when applied criteria exist', () => {
    assert.equal(isDiscoverySearchActive(true, true), true);
    assert.equal(isDiscoverySearchActive(true, false), false);
    assert.equal(isDiscoverySearchActive(false, true), false);
    assert.equal(isDiscoverySearchActive(false, false), false);
  });

  it('does not lock the map just because a Home recadrage ping exists', () => {
    assert.equal(
      resolveMapHandoffMode({ searchApplied: false, hasSearchCriteria: false }),
      'browse'
    );
    assert.equal(
      resolveMapHandoffMode({ searchApplied: true, hasSearchCriteria: true }),
      'search'
    );
  });

  it('recadres Map when Home publishes a new ping or a new search revision', () => {
    assert.equal(
      shouldApplyPendingHomeRecadrage({
        mapReady: false,
        transferId: 't1',
        appliedTransferId: null,
        searchActive: true,
        searchRevision: 1,
        focusedSearchRevision: null,
      }),
      false
    );
    assert.equal(
      shouldApplyPendingHomeRecadrage({
        mapReady: true,
        transferId: 't2',
        appliedTransferId: 't1',
        searchActive: true,
        searchRevision: 1,
        focusedSearchRevision: 1,
      }),
      true
    );
    assert.equal(
      shouldApplyPendingHomeRecadrage({
        mapReady: true,
        transferId: null,
        appliedTransferId: 't1',
        searchActive: true,
        searchRevision: 2,
        focusedSearchRevision: 1,
      }),
      true
    );
    assert.equal(
      shouldApplyPendingHomeRecadrage({
        mapReady: true,
        transferId: null,
        appliedTransferId: 't1',
        searchActive: true,
        searchRevision: 2,
        focusedSearchRevision: 2,
      }),
      false
    );
  });

  it('does not refetch the viewport on tab focus once bootstrapped', () => {
    assert.equal(
      shouldRefetchViewportOnTabFocus({
        bootstrapped: true,
        hasNewTransfer: false,
        hasNewSearchRevision: false,
      }),
      false
    );
    assert.equal(
      shouldRefetchViewportOnTabFocus({
        bootstrapped: false,
        hasNewTransfer: false,
        hasNewSearchRevision: false,
      }),
      true
    );
    assert.equal(
      shouldRefetchViewportOnTabFocus({
        bootstrapped: true,
        hasNewTransfer: true,
        hasNewSearchRevision: false,
      }),
      true
    );
  });

  it('keeps markers and sheet in lockstep while frozen unless explicitly ignored', () => {
    assert.equal(
      shouldPublishViewportToMap({ frozen: true, sheetStatus: 'viewportResults' }),
      false
    );
    assert.equal(
      shouldPublishViewportToMap({ frozen: false, sheetStatus: 'singleEvent' }),
      false
    );
    assert.equal(
      shouldPublishViewportToMap({
        frozen: true,
        sheetStatus: 'viewportResults',
        ignoreFreeze: true,
      }),
      true
    );
    assert.equal(
      shouldPublishViewportToMap({ frozen: false, sheetStatus: 'viewportResults' }),
      true
    );
  });

  it('does not wipe discovery criteria when searching the visible area', () => {
    assert.equal(shouldResetCriteriaOnAreaSearch(), false);
  });

  it('does not refresh after a programmatic move unless refreshAfter is true', () => {
    assert.equal(resolvePendingProgrammaticRefresh(undefined), false);
    assert.equal(resolvePendingProgrammaticRefresh(false), false);
    assert.equal(resolvePendingProgrammaticRefresh(true), true);
  });

  it('applies date client filters in browse when a when-criterion exists', () => {
    assert.equal(shouldApplyWhenFilters(false), false);
    assert.equal(shouldApplyWhenFilters(true), true);
    assert.equal(shouldApplyWhenFilters(false, { time: 'today' }), true);
    assert.equal(
      resolveMapClientFilters({ categories: ['arts-culture'], name: 'jazz' }, false).name,
      undefined
    );
    assert.equal(
      resolveMapClientFilters({ categories: ['arts-culture'] }, false).includePast,
      true
    );
  });

  it('always keeps category filters and applies when-filters in browse without the search query', () => {
    const filters = {
      categories: ['arts-culture'],
      subcategories: ['concert'],
      time: 'today' as const,
      name: 'jazz',
      includePast: false,
    };
    assert.deepEqual(resolveMapClientFilters(filters, false), {
      category: undefined,
      categories: ['arts-culture'],
      subcategory: undefined,
      subcategories: ['concert'],
      includePast: false,
      time: 'today',
      startDate: undefined,
      endDate: undefined,
      name: undefined,
    });
    assert.equal(resolveMapClientFilters(filters, true).time, 'today');
    assert.equal(resolveMapClientFilters(filters, true).name, 'jazz');
    assert.equal(resolveMapClientFilters(filters, true).includePast, false);
    assert.equal(resolveMapClientFilters({ ...filters, radiusKm: 20, centerLat: 48.8 }, false).radiusKm, undefined);
    assert.equal(resolveMapClientFilters({ ...filters, radiusKm: 20, centerLat: 48.8 }, false).centerLat, undefined);
  });

  it('uses the same default radius as Home for map recenter', () => {
    assert.equal(DISCOVERY_DEFAULT_RADIUS_KM, 20);
  });

  it('recadres Home → Map on the same browse or search radius', () => {
    const gps = { latitude: 48.86, longitude: 2.35 };
    const filters = createDefaultDiscoveryFilters();

    assert.deepEqual(
      resolveHomeMapRadiusTarget({
        searchActive: false,
        place: filters.place,
        userLocation: gps,
      }),
      { latitude: 48.86, longitude: 2.35, radiusKm: DISCOVERY_DEFAULT_RADIUS_KM }
    );

    filters.place = {
      center: { latitude: 43.3, longitude: 5.4 },
      radiusKm: 40,
    };
    assert.deepEqual(
      resolveHomeMapRadiusTarget({
        searchActive: true,
        place: filters.place,
        userLocation: gps,
      }),
      { latitude: 43.3, longitude: 5.4, radiusKm: 40 }
    );

    assert.equal(
      resolveHomeMapRadiusTarget({
        searchActive: false,
        place: { center: null },
        userLocation: null,
      }),
      null
    );
  });
});
