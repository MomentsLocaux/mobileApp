import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useMapDetailTransitionStore } from './mapDetailTransitionStore';
import type { EventWithCreator } from '../types/database';

describe('map detail transition store', () => {
  beforeEach(() => {
    useMapDetailTransitionStore.getState().clear();
  });

  it('keeps the selected map card context while detail is open', () => {
    useMapDetailTransitionStore.getState().prepare({
      origin: 'map-unit',
      eventId: 'event-a',
      event: { id: 'event-a', title: 'Event A' } as EventWithCreator,
      targetCardRect: { x: 16, y: 420, width: 358, height: 390 },
    });

    assert.equal(
      useMapDetailTransitionStore.getState().context?.eventId,
      'event-a',
    );
    assert.equal(useMapDetailTransitionStore.getState().returningEventId, null);
  });

  it('marks then clears the card return transition', () => {
    useMapDetailTransitionStore.getState().markReturning('event-a');
    assert.equal(
      useMapDetailTransitionStore.getState().returningEventId,
      'event-a',
    );

    useMapDetailTransitionStore.getState().clear();
    assert.equal(useMapDetailTransitionStore.getState().context, null);
    assert.equal(useMapDetailTransitionStore.getState().returningEventId, null);
  });

  it('keeps the bottom-sheet card as the return destination', () => {
    useMapDetailTransitionStore.getState().prepare({
      origin: 'map-sheet',
      eventId: 'event-sheet',
      event: { id: 'event-sheet', title: 'Sheet Event' } as EventWithCreator,
      targetCardRect: { x: 16, y: 260, width: 358, height: 360 },
    });

    assert.equal(
      useMapDetailTransitionStore.getState().context?.origin,
      'map-sheet',
    );
  });
});
