import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useMapResultsUIStore } from './mapResultsUIStore';
import type { EventWithCreator } from '../types/database';

const sampleEvent = (id: string): EventWithCreator =>
  ({
    id,
    title: `Event ${id}`,
    latitude: 49.3,
    longitude: 6.0,
  }) as EventWithCreator;

describe('map results UI store transitions', () => {
  beforeEach(() => {
    useMapResultsUIStore.setState({
      bottomSheetIndex: 0,
      sheetStatus: 'browsing',
      sheetEvents: [],
      visibleEventCount: 0,
      activeEventId: undefined,
      frozenViewport: null,
      viewportFetchError: null,
      viewportAreaWarning: null,
    });
  });

  it('publishes viewport results and clears loading state', () => {
    const events = [sampleEvent('a'), sampleEvent('b')];
    useMapResultsUIStore.getState().displayViewportResults(events, { totalCount: 42 });

    const state = useMapResultsUIStore.getState();
    assert.equal(state.sheetStatus, 'viewportResults');
    assert.equal(state.sheetEvents.length, 2);
    assert.equal(state.visibleEventCount, 42);
  });

  it('freezes viewport results then restores them when closing a single event sheet', () => {
    const events = [sampleEvent('a'), sampleEvent('b'), sampleEvent('c')];
    useMapResultsUIStore.getState().displayViewportResults(events, { totalCount: 3 });
    useMapResultsUIStore.getState().freezeViewportResults();
    useMapResultsUIStore.getState().selectSingleEvent(sampleEvent('b'), 1);

    assert.equal(useMapResultsUIStore.getState().sheetStatus, 'singleEvent');
    assert.ok(useMapResultsUIStore.getState().frozenViewport);
    assert.equal(useMapResultsUIStore.getState().frozenViewport?.events.length, 3);

    useMapResultsUIStore.getState().closeSheet();

    const restored = useMapResultsUIStore.getState();
    assert.equal(restored.sheetStatus, 'viewportResults');
    assert.equal(restored.sheetEvents.length, 3);
    assert.equal(restored.visibleEventCount, 3);
  });

  it('keeps highlight when viewport refresh still contains the active event', () => {
    const events = [sampleEvent('a'), sampleEvent('b')];
    useMapResultsUIStore.getState().displayViewportResults(events);
    useMapResultsUIStore.getState().highlightViewportEvent(sampleEvent('b'));

    useMapResultsUIStore.getState().displayViewportResults([sampleEvent('a'), sampleEvent('b')]);

    assert.equal(useMapResultsUIStore.getState().activeEventId, 'b');
  });

  it('clears highlight when refreshed viewport no longer contains the active event', () => {
    useMapResultsUIStore.getState().displayViewportResults([sampleEvent('a'), sampleEvent('b')]);
    useMapResultsUIStore.getState().highlightViewportEvent(sampleEvent('b'));

    useMapResultsUIStore.getState().displayViewportResults([sampleEvent('a')]);

    assert.equal(useMapResultsUIStore.getState().activeEventId, undefined);
  });

  it('stores and clears viewport fetch errors independently from sheet status', () => {
    useMapResultsUIStore.getState().setViewportFetchError('Erreur réseau');
    assert.equal(useMapResultsUIStore.getState().viewportFetchError, 'Erreur réseau');

    useMapResultsUIStore.getState().setViewportFetchError(null);
    assert.equal(useMapResultsUIStore.getState().viewportFetchError, null);
  });

  it('stores a wide-area warning without erasing current results', () => {
    useMapResultsUIStore.getState().displayViewportResults([sampleEvent('a')]);
    useMapResultsUIStore.getState().setViewportAreaWarning('Zone trop large');

    const state = useMapResultsUIStore.getState();
    assert.equal(state.viewportAreaWarning, 'Zone trop large');
    assert.equal(state.sheetEvents.length, 1);

    useMapResultsUIStore.getState().setViewportAreaWarning(null);
    assert.equal(useMapResultsUIStore.getState().viewportAreaWarning, null);
  });
});
