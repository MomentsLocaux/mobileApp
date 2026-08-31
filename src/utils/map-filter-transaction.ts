import type { EventMetaFilter } from '@/utils/filter-events';

export function resolveViewportRefreshAfterFilter(options: {
  reapplied: boolean;
  metaFilter: EventMetaFilter;
  previousMetaFilter?: EventMetaFilter;
  forceRefresh?: boolean;
}): boolean {
  return (
    options.forceRefresh === true ||
    options.metaFilter === 'past' ||
    options.previousMetaFilter === 'past' ||
    !options.reapplied
  );
}
