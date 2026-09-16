/** First paint and each extra page in Home / map sheet lists. */
export const DISCOVERY_LIST_PAGE_SIZE = 50;
/** Start the next page when the user is this many rows from the current end. */
export const DISCOVERY_LIST_PREFETCH_REMAINING = 10;

export function resolveDiscoveryListWindowCount(options: {
  totalCount: number;
  revealedCount: number;
  pageSize?: number;
}): number {
  const pageSize = options.pageSize ?? DISCOVERY_LIST_PAGE_SIZE;
  if (options.totalCount <= 0) return 0;
  if (options.totalCount <= pageSize) return options.totalCount;
  return Math.min(options.totalCount, Math.max(pageSize, options.revealedCount));
}

export function nextDiscoveryListWindowCount(options: {
  totalCount: number;
  revealedCount: number;
  pageSize?: number;
}): number {
  const pageSize = options.pageSize ?? DISCOVERY_LIST_PAGE_SIZE;
  return Math.min(
    options.totalCount,
    resolveDiscoveryListWindowCount(options) + pageSize
  );
}

export function shouldPrefetchNextDiscoveryPage(options: {
  totalCount: number;
  revealedCount: number;
  highestViewedIndex: number;
  prefetchRemaining?: number;
}): boolean {
  if (options.totalCount <= 0) return false;
  const revealed = resolveDiscoveryListWindowCount(options);
  if (revealed >= options.totalCount) return false;
  if (options.highestViewedIndex < 0) return false;
  const remaining = options.prefetchRemaining ?? DISCOVERY_LIST_PREFETCH_REMAINING;
  return options.highestViewedIndex >= revealed - remaining;
}

/** Detect a new ordered result set (sort, search, or viewport) without hashing every id. */
export function discoveryListOrderKey(ids: string[]): string {
  if (!ids.length) return '0';
  const pivotIndex = Math.min(DISCOVERY_LIST_PAGE_SIZE - 1, ids.length - 1);
  return `${ids.length}:${ids[0]}:${ids[pivotIndex]}:${ids[ids.length - 1]}`;
}

export function windowCountToIncludeIndex(
  index: number,
  pageSize = DISCOVERY_LIST_PAGE_SIZE
): number {
  if (index < 0) return pageSize;
  return Math.ceil((index + 1) / pageSize) * pageSize;
}

export function formatDiscoveryResultCount(count: number): string {
  if (count <= 0) return 'Aucun événement';
  return `${count} événement${count > 1 ? 's' : ''}`;
}
