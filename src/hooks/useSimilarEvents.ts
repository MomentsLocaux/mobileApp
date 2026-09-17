import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { EventsService } from '@/services/events.service';
import { useTaxonomyStore } from '@/store/taxonomyStore';
import type { EventWithCreator } from '@/types/database';
import { extractEventCoords } from '@/utils/event-coords';
import { prefetchEventMedia } from '@/utils/prefetch-event-media';
import { getBoundsFromRadiusKm } from '@/utils/search-helpers';
import {
  pickSimilarEvents,
  resolveEventCategoryKey,
  SIMILAR_EVENTS_FETCH_LIMIT,
  SIMILAR_EVENTS_LIMIT,
  SIMILAR_EVENTS_RADIUS_KM,
} from '@/utils/similar-events';

type Options = {
  ready: boolean;
};

export function useSimilarEvents(source: EventWithCreator | null, { ready }: Options) {
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const sourceTagsKey = Array.isArray(source?.tags) ? source.tags.join('|') : '';
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const current = sourceRef.current;
    if (!ready || !current?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const origin = extractEventCoords(current);
    if (!origin || !resolveEventCategoryKey(current)) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setEvents([]);
    const handle = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        setLoading(true);
        try {
          const bbox = getBoundsFromRadiusKm(
            origin.latitude,
            origin.longitude,
            SIMILAR_EVENTS_RADIUS_KM,
          );
          const candidates = await EventsService.listEvents({
            bbox,
            limit: SIMILAR_EVENTS_FETCH_LIMIT,
            timeScope: 'current',
          });
          if (cancelled) return;
          const taxonomy = useTaxonomyStore.getState().tagsMap;
          const picked = pickSimilarEvents({
            source: current,
            candidates,
            origin,
            taxonomy,
            limit: SIMILAR_EVENTS_LIMIT,
          });
          setEvents(picked);
          picked.forEach((item) => prefetchEventMedia(item));
        } catch (error) {
          console.warn('useSimilarEvents', error);
          if (!cancelled) setEvents([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [ready, source?.category, source?.id, source?.latitude, source?.longitude, sourceTagsKey]);

  return { events, loading };
}
