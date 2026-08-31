import type { EventMetaFilter } from './filter-events';

/** Server-side temporal scope for public event listings. */
export type EventTimeScope = 'ongoing' | 'upcoming' | 'current' | 'all';

export const resolveEventTimeScope = (params: {
  metaFilter?: EventMetaFilter;
  searchActive?: boolean;
  includePast?: boolean;
  /** @deprecated Prefer metaFilter + searchActive */
  legacyIncludePast?: boolean;
}): EventTimeScope => {
  const { metaFilter = 'all', includePast = false, legacyIncludePast = false } = params;

  if (metaFilter === 'past') return 'all';
  if (metaFilter === 'upcoming') return 'upcoming';
  if (metaFilter === 'live') return 'ongoing';
  if (includePast || legacyIncludePast) return 'all';
  if (metaFilter === 'all') return 'current';
  return 'ongoing';
};
