import type { EventMetaFilter } from '@/utils/filter-events';

const META_SCOPE_LABELS: Record<EventMetaFilter, string> = {
  all: 'dans la zone',
  live: 'en cours',
  upcoming: 'à venir',
  past: 'passés',
};

/** Above this count we use the "Plus de X" wording. */
export const VIEWPORT_PEEK_PLUS_THRESHOLD = 100;

export function formatViewportPeekLabel(
  count: number,
  metaFilter: EventMetaFilter = 'all',
  isLoading = false
): string {
  const scopeLabel = META_SCOPE_LABELS[metaFilter];

  if (isLoading) return 'Chargement...';

  if (count <= 0) {
    return metaFilter === 'all'
      ? 'Aucun événement dans la zone'
      : `Aucun événement ${scopeLabel}`;
  }

  if (count > VIEWPORT_PEEK_PLUS_THRESHOLD) {
    return `Plus de ${count} événement${count > 1 ? 's' : ''} ${scopeLabel}`;
  }

  return `${count} événement${count > 1 ? 's' : ''} ${scopeLabel}`;
}
