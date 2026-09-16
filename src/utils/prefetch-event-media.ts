import { Image } from 'react-native';
import type { EventWithCreator } from '@/types/database';
import { getEventPrefetchUrls } from '@/utils/event-card-display';

export function prefetchEventMedia(
  event: Pick<EventWithCreator, 'cover_url' | 'media'> | null | undefined,
  options?: { includeGallery?: boolean },
): void {
  for (const uri of getEventPrefetchUrls(event, options)) {
    void Image.prefetch(uri).catch(() => undefined);
  }
}
