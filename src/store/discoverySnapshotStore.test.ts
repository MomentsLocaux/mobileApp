import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  HOME_SNAPSHOT_EVENT_LIMIT,
  isMapSnapshotStale,
  MAP_SNAPSHOT_STALE_MS,
  useDiscoverySnapshotStore,
} from './discoverySnapshotStore';

describe('discovery snapshots', () => {
  beforeEach(() => {
    useDiscoverySnapshotStore.setState({
      home: null,
      map: null,
      hydrated: false,
    });
  });

  it('caps Home snapshot ids to the on-screen budget', () => {
    useDiscoverySnapshotStore.getState().setHomeSnapshot({
      queryKey: '48.8:2.3:40',
      center: { latitude: 48.8, longitude: 2.3 },
      radiusKm: 40,
      eventIds: Array.from({ length: HOME_SNAPSHOT_EVENT_LIMIT + 20 }, (_, index) => `e-${index}`),
      storedAt: 1,
    });
    assert.equal(
      useDiscoverySnapshotStore.getState().home?.eventIds.length,
      HOME_SNAPSHOT_EVENT_LIMIT,
    );
  });

  it('treats a map snapshot older than 24h as stale', () => {
    const snapshot = {
      camera: { latitude: 48.8, longitude: 2.3, zoom: 12 },
      bounds: null,
      markerEventIds: ['a'],
      sheetEventIds: ['a'],
      storedAt: Date.now() - MAP_SNAPSHOT_STALE_MS - 10,
    };
    assert.equal(isMapSnapshotStale(snapshot), true);
    assert.equal(isMapSnapshotStale({ ...snapshot, storedAt: Date.now() }), false);
  });

  it('marks the store hydrated after a disk read, even without a snapshot', () => {
    useDiscoverySnapshotStore.getState().markHydrated();
    assert.equal(useDiscoverySnapshotStore.getState().hydrated, true);
  });
});
