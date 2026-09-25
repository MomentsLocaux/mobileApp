/** Stats fetched before the rest of a 50-row discovery window. Spotlight is always included. */
export const DISCOVERY_STATS_IMMEDIATE_LIMIT = 8;

export function splitDiscoveryEnrichmentIds(options: {
  windowIds: string[];
  spotlightIds?: string[];
  immediateLimit?: number;
}): { immediate: string[]; deferred: string[] } {
  const limit = options.immediateLimit ?? DISCOVERY_STATS_IMMEDIATE_LIMIT;
  const seen = new Set<string>();
  const immediate: string[] = [];

  const add = (id: string, ignoreLimit = false) => {
    if (!id || seen.has(id)) return;
    if (!ignoreLimit && immediate.length >= limit) return;
    seen.add(id);
    immediate.push(id);
  };

  (options.spotlightIds ?? []).forEach((id) => add(id, true));
  for (const id of options.windowIds) add(id, false);

  return {
    immediate,
    deferred: options.windowIds.filter((id) => id && !seen.has(id)),
  };
}
