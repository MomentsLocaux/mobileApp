import { useCallback } from 'react';
import { traceMapSheetPerf } from '@/utils/map-sheet-perf-trace';
import type { RefObject } from 'react';
import type { SearchResultsBottomSheetHandle } from '@/components/search/SearchResultsBottomSheet';
import type { EventWithCreator } from '@/types/database';

type SheetStatus = 'browsing' | 'loading' | 'viewportResults' | 'singleEvent';

type Params = {
  resultsSheetRef: RefObject<SearchResultsBottomSheetHandle | null>;
  activeEventId?: string;
  sheetStatus: SheetStatus;
  sheetEvents: EventWithCreator[];
  closeSheet: () => void;
  lockViewportForSheet: () => Promise<void>;
  focusOnEvent: (event: EventWithCreator, options?: { bumpZoom?: boolean }) => void;
  setUnitCardEvent: (event: EventWithCreator | null) => void;
};

export function useMapSheetOrchestration({
  resultsSheetRef,
  activeEventId,
  sheetStatus,
  sheetEvents,
  closeSheet,
  lockViewportForSheet,
  focusOnEvent,
  setUnitCardEvent,
}: Params) {
  const scrollToActiveEventIfNeeded = useCallback(
    (sheetIndex: number) => {
      if (sheetIndex < 1 || !activeEventId) return;
      requestAnimationFrame(() => {
        resultsSheetRef.current?.scrollToEvent(activeEventId);
      });
    },
    [activeEventId, resultsSheetRef]
  );

  const handleSheetCollapsedSideEffects = useCallback(() => {
    traceMapSheetPerf('closeSheet');
    closeSheet();
  }, [closeSheet]);

  const handleSheetExpandedSideEffects = useCallback(() => {
    traceMapSheetPerf('lockViewportForSheet');
    setUnitCardEvent(null);
    void lockViewportForSheet();
  }, [lockViewportForSheet, setUnitCardEvent]);

  const handleSingleEventSheetSideEffects = useCallback(
    (sheetIndex: number) => {
      if (sheetIndex <= 0 || sheetStatus !== 'singleEvent' || sheetEvents.length === 0) return;
      traceMapSheetPerf('focusOnEvent', { reason: 'singleEventSheet' });
      focusOnEvent(sheetEvents[0], { bumpZoom: false });
    },
    [focusOnEvent, sheetEvents, sheetStatus]
  );

  const applySheetSideEffects = useCallback(
    (sheetIndex: number) => {
      if (sheetIndex === 0) {
        handleSheetCollapsedSideEffects();
      } else {
        handleSheetExpandedSideEffects();
      }

      handleSingleEventSheetSideEffects(sheetIndex);
      scrollToActiveEventIfNeeded(sheetIndex);
    },
    [
      handleSheetCollapsedSideEffects,
      handleSheetExpandedSideEffects,
      handleSingleEventSheetSideEffects,
      scrollToActiveEventIfNeeded,
    ]
  );

  return {
    applySheetSideEffects,
    handleSheetCollapsedSideEffects,
    handleSheetExpandedSideEffects,
    handleSingleEventSheetSideEffects,
    scrollToActiveEventIfNeeded,
  };
}
