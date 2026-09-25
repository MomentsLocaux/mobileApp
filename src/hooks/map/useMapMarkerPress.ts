import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { MapWrapperHandle } from '@/components/map';
import { EventsService } from '@/services/events.service';
import type { EventWithCreator } from '@/types/database';
import type { MapBounds } from '@/types/map-events';
import { resolveCachedMapEvent, useEventPreviewStore } from '@/store/eventPreviewStore';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { useMapResultsUIStore } from '@/store';

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
  focusOnEvent: (
    event: EventWithCreator,
    options?: { bumpZoom?: boolean; paddingBottom?: number },
  ) => void;
  focusPaddingBottom?: number;
  setUnitCardEvent: (event: EventWithCreator | null) => void;
  collapseSheetToPeek?: () => void;
  onMarkerLoadError?: (message: string) => void;
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
  focusPaddingBottom,
  setUnitCardEvent,
  collapseSheetToPeek,
  onMarkerLoadError,
}: Params) {
  const eventCacheRef = useRef<Map<string, EventWithCreator>>(new Map());

  const handleFeaturePress = useCallback(
    async (id: string) => {
      cancelAllMapRequests();
      const requestId = nextMarkerRequestId();

      const present = (event: EventWithCreator) => {
        eventCacheRef.current.set(id, event);
        useEventPreviewStore.getState().rememberEvent(event);
        prefetchEventMedia(event, { priority: 'visible' });
        highlightViewportEvent(event);
        setUnitCardEvent(event);
        collapseSheetToPeek?.();
        focusOnEvent(event, {
          bumpZoom: false,
          paddingBottom: focusPaddingBottom,
        });
      };

      try {
        const preview =
          eventCacheRef.current.get(id) ??
          resolveCachedMapEvent(id, [
            sheetEvents,
            useMapResultsUIStore.getState().frozenViewport?.events,
          ]);

        if (preview) {
          present(preview);
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
          void EventsService.getEventById(id).then((full) => {
            if (!isMarkerRequestCurrent(requestId) || !full) return;
            eventCacheRef.current.set(id, full);
            useEventPreviewStore.getState().rememberEvent(full);
          });
          return;
        }

        const event = await EventsService.getEventById(id);
        if (!isMarkerRequestCurrent(requestId)) return;
        if (!event) return;

        present(event);
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
      } catch (error) {
        if (!isMarkerRequestCurrent(requestId)) return;
        console.warn('getEventById error', error);
        onMarkerLoadError?.('Impossible d\'afficher cet événement. Réessayez.');
      }
    },
    [
      cancelAllMapRequests,
      focusOnEvent,
      focusPaddingBottom,
      freezeViewportResults,
      frozenViewportBoundsRef,
      highlightViewportEvent,
      isMarkerRequestCurrent,
      mapRef,
      nextMarkerRequestId,
      collapseSheetToPeek,
      onMarkerLoadError,
      setUnitCardEvent,
      sheetEvents,
      viewportFrozenRef,
    ]
  );

  return { handleFeaturePress, eventCacheRef };
}
