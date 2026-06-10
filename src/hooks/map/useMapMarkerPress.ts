import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { MapWrapperHandle } from '@/components/map';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';
import type { MapBounds } from '@/types/map-events';

type Params = {
  mapRef: RefObject<MapWrapperHandle | null>;
  sheetEvents: EventWithCreator[];
  viewportFrozenRef: RefObject<boolean>;
  frozenViewportBoundsRef: RefObject<MapBounds | null>;
  cancelAllMapRequests: () => void;
  nextMarkerRequestId: () => number;
  isMarkerRequestCurrent: (requestId: number) => boolean;
  highlightViewportEvent: (event: EventWithCreator) => void;
  freezeViewportResults: () => void;
  focusOnEvent: (event: EventWithCreator, options?: { bumpZoom?: boolean }) => void;
  setUnitCardEvent: (event: EventWithCreator | null) => void;
  collapseSheetToPeek?: () => void;
};

export function useMapMarkerPress({
  mapRef,
  sheetEvents,
  viewportFrozenRef,
  frozenViewportBoundsRef,
  cancelAllMapRequests,
  nextMarkerRequestId,
  isMarkerRequestCurrent,
  highlightViewportEvent,
  freezeViewportResults,
  focusOnEvent,
  setUnitCardEvent,
  collapseSheetToPeek,
}: Params) {
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());

  const handleFeaturePress = useCallback(
    async (id: string) => {
      cancelAllMapRequests();
      const requestId = nextMarkerRequestId();

      try {
        const cached = eventCacheRef.current.get(id) ?? sheetEvents.find((event) => event.id === id);
        const event = cached ?? (await EventsService.getEventById(id));

        if (!isMarkerRequestCurrent(requestId)) return;
        if (!event) return;

        eventCacheRef.current.set(id, event);
        highlightViewportEvent(event);
        setUnitCardEvent(event);
        collapseSheetToPeek?.();

        if (!viewportFrozenRef.current) {
          if (!frozenViewportBoundsRef.current) {
            const bounds = await mapRef.current?.getVisibleBounds?.();
            if (bounds) {
              frozenViewportBoundsRef.current = bounds;
            }
          }
          viewportFrozenRef.current = true;
          freezeViewportResults();
        }

        focusOnEvent(event, { bumpZoom: false });
      } catch (error) {
        if (!isMarkerRequestCurrent(requestId)) return;
        console.warn('getEventById error', error);
      }
    },
    [
      cancelAllMapRequests,
      focusOnEvent,
      freezeViewportResults,
      frozenViewportBoundsRef,
      highlightViewportEvent,
      isMarkerRequestCurrent,
      mapRef,
      nextMarkerRequestId,
      collapseSheetToPeek,
      setUnitCardEvent,
      sheetEvents,
      viewportFrozenRef,
    ]
  );

  return { handleFeaturePress, eventCacheRef };
}
