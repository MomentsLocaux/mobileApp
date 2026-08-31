import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createDefaultDiscoveryFilters } from '../utils/discovery-filters';
import type { EventWithCreator } from '../types/database';
import { useMapTransferStore } from './mapTransferStore';

describe('home to map transfer store', () => {
  beforeEach(() => {
    useMapTransferStore.getState().clearHomeTransfer();
  });

  it('keeps an ordered in-memory snapshot and clears it explicitly', () => {
    const filters = createDefaultDiscoveryFilters();
    filters.content.categories = ['music'];
    const events = [{ id: 'b' }, { id: 'a' }] as EventWithCreator[];

    const transfer = useMapTransferStore.getState().setHomeTransfer({
      filters,
      events,
      bounds: { sw: [5.9, 49.1], ne: [6.2, 49.4] },
    });
    filters.content.categories.push('sports');
    events.reverse();

    assert.deepEqual(transfer.events.map((event) => event.id), ['b', 'a']);
    assert.deepEqual(transfer.filters.content.categories, ['music']);

    useMapTransferStore.getState().clearHomeTransfer();
    assert.equal(useMapTransferStore.getState().homeTransfer, null);
  });
});
