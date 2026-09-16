import type { EventWithCreator } from '@/types/database';
import { prefetchCoverUris } from '@/components/events/EventCoverImage';
import { getEventPrefetchUrls } from '@/utils/event-card-display';

export function prefetchEventMedia(
  event: Pick<EventWithCreator, 'cover_url' | 'media'> | null | undefined,
  options?: { includeGallery?: boolean },
): void {
  prefetchCoverUris(getEventPrefetchUrls(event, options));
}
