import type { EventMetaFilter } from '@/utils/filter-events';

const META_SCOPE_LABELS: Record<EventMetaFilter, string> = {
  all: '',
  live: 'en cours',
  upcoming: 'à venir',
  past: 'passés',
};

/** Above this count we use the "Plus de X" wording. */
export const VIEWPORT_PEEK_PLUS_THRESHOLD = 100;

function momentNoun(count: number): string {
  return count > 1 ? 'Moments' : 'Moment';
}

export function formatViewportPeekLabel(
  count: number,
  metaFilter: EventMetaFilter = 'all',
): string {
  const scope = META_SCOPE_LABELS[metaFilter];
  const scopeChunk = scope ? ` ${scope}` : '';

  if (count <= 0) {
    return `Aucun Moment${scopeChunk} dans la zone`;
  }

  const noun = momentNoun(count);
  if (count > VIEWPORT_PEEK_PLUS_THRESHOLD) {
    return `Plus de ${count} ${noun}${scopeChunk} dans la zone`;
  }

  return `${count} ${noun}${scopeChunk} dans la zone`;
}

export function formatViewportPeekHeading(
  count: number,
  metaFilter: EventMetaFilter = 'all',
): string {
  return formatViewportPeekLabel(count, metaFilter);
}

export function formatViewportPeekSubtitle(count: number): string {
  if (count <= 0) return 'Aucun Moment proposé pour le moment';
  return 'Découvre tous les Moments proposés';
}
