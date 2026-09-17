import { sanitizeIlikeFragment } from './event-name-search';

/** PostgREST `or()` matching name, city, or region/zone. */
export function buildMemberSearchOrFilter(rawQuery: string): string | null {
  const fragment = sanitizeIlikeFragment(rawQuery);
  if (!fragment) return null;
  return `display_name.ilike.%${fragment}%,city.ilike.%${fragment}%,region.ilike.%${fragment}%`;
}
