import type { EventWithCreator } from '@/types/database';
import { prefetchCoverUris } from '@/components/events/EventCoverImage';
import { getEventPrefetchUrls } from '@/utils/event-card-display';
import type { CoverPrefetchPriority } from '@/utils/cover-prefetch-queue';

export function prefetchEventMedia(
  event: Pick<EventWithCreator, 'cover_url' | 'media'> | null | undefined,
  options?: { includeGallery?: boolean; priority?: CoverPrefetchPriority },
): void {
  prefetchCoverUris(getEventPrefetchUrls(event, options), options?.priority ?? 'ahead');
}
