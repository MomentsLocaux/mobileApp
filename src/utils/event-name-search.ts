/**
 * Tokenize user "Quoi" text so Home / Map can Ctrl+F event title + description
 * without a dedicated RPC. PostgREST `or()` fragments must not contain `,` `%` `_`.
 */

const NAME_SEARCH_STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'd',
  'l',
  'au',
  'aux',
  'et',
  'ou',
  'a',
  'à',
  'en',
  'sur',
  'pour',
]);

const MAX_NAME_TOKENS = 6;

export function sanitizeIlikeFragment(raw: string): string {
  return raw
    .replace(/[%_,.()\\*]/g, ' ')
    .replace(/['’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeNameQuery(query: string): string[] {
  const cleaned = sanitizeIlikeFragment(query).toLowerCase();
  if (!cleaned) return [];

  const parts = cleaned.split(' ').filter(Boolean);
  const tokens = parts.filter((part) => part.length >= 2 && !NAME_SEARCH_STOP_WORDS.has(part));
  if (tokens.length > 0) {
    return Array.from(new Set(tokens)).slice(0, MAX_NAME_TOKENS);
  }

  if (cleaned.length >= 3) return [cleaned];
  return [];
}

/** Title + description only — same fields as the server `ilike` fetch. */
export function eventNameSearchHaystack(event: {
  title?: string | null;
  description?: string | null;
}): string {
  return [event.title, event.description]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
}

/**
 * Ctrl+F: the full phrase in title or description, otherwise every token
 * must appear somewhere in title+description.
 */
export function eventMatchesNameQuery(
  event: {
    title?: string | null;
    description?: string | null;
  },
  query: string
): boolean {
  const phrase = sanitizeIlikeFragment(query).toLowerCase();
  if (!phrase) return true;

  const title = (event.title || '').toLowerCase();
  const description = (event.description || '').toLowerCase();
  if (title.includes(phrase) || description.includes(phrase)) return true;

  const tokens = tokenizeNameQuery(query);
  if (tokens.length === 0) return false;
  const haystack = `${title} ${description}`;
  return tokens.every((token) => haystack.includes(token));
}

/**
 * One PostgREST `or()` fragment per token (title OR description).
 * Callers should `.or(fragment)` once per token — `append` ANDs them.
 */
export function nameQueryOrFilters(query: string): string[] {
  return tokenizeNameQuery(query).map(
    (token) => `title.ilike.%${token}%,description.ilike.%${token}%`
  );
}
