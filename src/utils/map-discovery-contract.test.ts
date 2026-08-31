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
  shouldApplyBrowseWhatWhenFilters,
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

  it('applies what/when client filters only while a search is active', () => {
    assert.equal(shouldApplyBrowseWhatWhenFilters(false), false);
    assert.equal(shouldApplyBrowseWhatWhenFilters(true), true);
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
