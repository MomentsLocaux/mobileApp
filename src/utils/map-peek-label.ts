import type { EventMetaFilter } from '@/utils/filter-events';

const META_SCOPE_LABELS: Record<EventMetaFilter, string> = {
  all: 'dans la zone',
  live: 'en cours',
  upcoming: 'à venir',
  past: 'passés',
};

/**
 * First reveal: wait long enough to absorb bootstrap / chained viewport fetches
 * before committing a count to the peek.
 */
export const VIEWPORT_COUNT_FIRST_SETTLE_MS = 900;

/** Later updates: brief quiet window so intermediate publishes don't flicker the number. */
export const VIEWPORT_COUNT_UPDATE_MS = 450;

/** @deprecated Use VIEWPORT_COUNT_FIRST_SETTLE_MS / VIEWPORT_COUNT_UPDATE_MS */
export const VIEWPORT_COUNT_SETTLE_MS = VIEWPORT_COUNT_FIRST_SETTLE_MS;

/** Single wait copy — same typography/height slot as the final peek label. */
export const MAP_WAITING_MESSAGE = 'On repère les événements autour de toi…';

export function getMapWaitingMessage(): string {
  return MAP_WAITING_MESSAGE;
}

export function formatViewportPeekLabel(
  count: number,
  metaFilter: EventMetaFilter = 'all',
  isWaiting = false,
  options?: { waitingMessage?: string }
): string {
  if (isWaiting) {
    return options?.waitingMessage ?? MAP_WAITING_MESSAGE;
  }

  const scopeLabel = META_SCOPE_LABELS[metaFilter];

  if (count <= 0) {
    return metaFilter === 'all'
      ? 'Aucun événement dans la zone'
      : `Aucun événement ${scopeLabel}`;
  }

  return `${count} événement${count > 1 ? 's' : ''} ${scopeLabel}`;
}
