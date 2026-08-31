import type { EventMetaFilter } from './filter-events';
import { resolveEventTimeScope } from './event-time-scope';

export function resolveViewportRefreshAfterFilter(options: {
  reapplied: boolean;
  metaFilter: EventMetaFilter;
  previousMetaFilter?: EventMetaFilter;
  forceRefresh?: boolean;
  searchActive?: boolean;
  includePast?: boolean;
}): boolean {
  if (options.forceRefresh === true) return true;
  if (!options.reapplied) return true;
  if (options.metaFilter === 'past' || options.previousMetaFilter === 'past') return true;
  if (!options.previousMetaFilter || options.previousMetaFilter === options.metaFilter) {
    return false;
  }
  const previousScope = resolveEventTimeScope({
    metaFilter: options.previousMetaFilter,
    searchActive: options.searchActive,
    includePast: options.includePast,
  });
  const nextScope = resolveEventTimeScope({
    metaFilter: options.metaFilter,
    searchActive: options.searchActive,
    includePast: options.includePast,
  });
  return previousScope !== nextScope;
}
