import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useMapTransferStore } from './mapTransferStore';

describe('home to map transfer store', () => {
  beforeEach(() => {
    useMapTransferStore.getState().clearHomeTransfer();
  });

  it('is a one-shot recadrage ping that can be replaced then cleared', () => {
    const first = useMapTransferStore.getState().setHomeTransfer();
    const second = useMapTransferStore.getState().setHomeTransfer();
    assert.notEqual(first.id, second.id);
    assert.equal(useMapTransferStore.getState().homeTransfer?.id, second.id);
    useMapTransferStore.getState().clearHomeTransfer();
    assert.equal(useMapTransferStore.getState().homeTransfer, null);
  });
});
