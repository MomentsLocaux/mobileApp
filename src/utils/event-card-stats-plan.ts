/** Public stats already return views_count from event_views; the dedicated RPC is a fallback. */
export function shouldFetchEventViewsFallback(publicStatsError: unknown): boolean {
  return Boolean(publicStatsError);
}
