/**
 * Tool: search_events (ADR 008 / SCRUM-59)
 * Sole source of real published event IDs for Lumia.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  address: string | null;
  venue_name: string | null;
  category: string | null;
  starts_at: string | null;
  status: string | null;
};

export type SearchEventsResult = {
  events: EventRow[];
  query: {
    keywords: string[];
    city: string | null;
    from: string | null;
    to: string | null;
  };
};

const STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'au',
  'aux',
  'et',
  'ou',
  'a',
  'en',
  'dans',
  'sur',
  'pour',
  'par',
  'ce',
  'cet',
  'cette',
  'quoi',
  'que',
  'qui',
  'faire',
  'pres',
  'chez',
  'moi',
  'nous',
  'toi',
  'il',
  'y',
  'est',
  'trouve',
  'trouver',
  'cherche',
  'chercher',
  'veux',
  'voudrais',
  'peux',
  'voir',
  'moment',
  'moments',
  'event',
  'events',
  'evenement',
  'evenements',
  'quel',
  'quels',
  'quelle',
  'quelles',
  'combien',
  'quoi',
  'as',
  'tu',
  'ya',
  'til',
  'aujourd',
  'hui',
  'demain',
  'soir',
  'matin',
  'week',
  'weekend',
  'semaine',
]);

/** Synonym expansion for common FR leisure queries. */
const SYNONYMS: Record<string, string[]> = {
  brocante: ['brocante', 'vide-grenier', 'vide grenier', 'braderie'],
  'vide-grenier': ['vide-grenier', 'vide grenier', 'brocante'],
  concert: ['concert', 'live', 'musique'],
  marche: ['marche', 'market', 'foire'],
  festival: ['festival', 'fete'],
  expo: ['expo', 'exposition', 'musee'],
  atelier: ['atelier', 'workshop'],
  theatre: ['theatre', 'spectacle'],
  cinema: ['cinema', 'film', 'projection'],
  sport: ['sport', 'match', 'tournoi'],
  rando: ['rando', 'randonnee', 'balade'],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();
}

const NOT_A_CITY = new Set([
  'concert',
  'concerts',
  'festival',
  'marche',
  'brocante',
  'expo',
  'atelier',
  'theatre',
  'cinema',
  'sport',
  'rando',
  'demain',
  'aujourd',
  'soir',
  'matin',
  'week',
  'weekend',
  'semaine',
  'evenement',
  'moment',
  'moments',
  'jazz',
  'musique',
  'moi',
  'toi',
  'nous',
  'vous',
]);

function extractCity(message: string): string | null {
  const n = normalize(message);
  const matches = [
    ...n.matchAll(/\b(?:pres de|pres|aupres de|a|sur|dans)\s+([a-z0-9-]{3,}(?:\s+[a-z0-9-]{2,})?)/g),
  ];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const city = matches[i]?.[1]?.trim();
    if (!city) continue;
    const head = city.split(/\s+/)[0] ?? city;
    if (/^(demain|aujourd|soir|matin|week|semaine)/.test(head)) continue;
    if (NOT_A_CITY.has(head)) continue;
    return city;
  }
  return null;
}

function extractDateRange(message: string, now = new Date()): { from: string | null; to: string | null } {
  const n = normalize(message);
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  };
  const addDays = (d: Date, days: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + days);
    return x;
  };

  const today = startOfDay(now);

  if (/\baujourd.?hui\b|\bce soir\b/.test(n)) {
    return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
  }
  if (/\bdemain\b/.test(n)) {
    const d = addDays(today, 1);
    return { from: d.toISOString(), to: addDays(d, 1).toISOString() };
  }
  if (/\b(ce )?week[\s-]?end\b|\bweek end\b/.test(n)) {
    // Next Sat–Sun window (rough): from Friday evening-ish to Monday
    const day = today.getUTCDay(); // 0 Sun
    const toSat = (6 - day + 7) % 7 || 0;
    const sat = addDays(today, day === 6 ? 0 : toSat);
    return { from: sat.toISOString(), to: addDays(sat, 2).toISOString() };
  }
  if (/\bcette semaine\b/.test(n)) {
    return { from: today.toISOString(), to: addDays(today, 7).toISOString() };
  }
  // Default: upcoming 30 days (avoid past noise)
  return { from: today.toISOString(), to: addDays(today, 30).toISOString() };
}

function expandKeywords(message: string): string[] {
  const raw = normalize(message)
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    const syns = SYNONYMS[t];
    if (syns) syns.forEach((s) => out.add(normalize(s).replace(/\s+/g, ' ')));
  }
  // Also multi-word synonym keys
  const n = normalize(message);
  if (n.includes('vide grenier') || n.includes('vide-grenier')) {
    SYNONYMS['vide-grenier'].forEach((s) => out.add(normalize(s)));
  }
  return [...out].slice(0, 12);
}

function scoreEvent(event: EventRow, keywords: string[], city: string | null): number {
  const hay = normalize(
    [event.title, event.description, event.city, event.address, event.venue_name, event.category]
      .filter(Boolean)
      .join(' '),
  );
  let score = keywords.reduce((s, kw) => (hay.includes(kw.replace(/\s+/g, ' ')) || hay.includes(kw) ? s + 1 : s), 0);
  if (city && event.city && normalize(event.city).includes(city)) score += 3;
  if (city && hay.includes(city)) score += 1;
  return score;
}

type EventsClient = Pick<SupabaseClient, 'from'>;

/**
 * search_events — query published events only.
 */
export async function searchEvents(
  supabase: EventsClient,
  message: string,
  hintCity?: string | null,
  limit = 8,
): Promise<SearchEventsResult> {
  const city = hintCity?.trim() ? normalize(hintCity) : extractCity(message);
  const { from, to } = extractDateRange(message);
  const keywords = expandKeywords(message).filter((k) => !city || k !== city);

  let query = supabase
    .from('events')
    .select('id,title,description,city,address,venue_name,category,starts_at,status')
    .eq('status', 'published')
    .limit(60);

  if (from) query = query.gte('starts_at', from);
  if (to) query = query.lt('starts_at', to);

  if (city) {
    query = query.ilike('city', `%${city}%`);
  } else if (keywords.length) {
    const orFilter = keywords
      .slice(0, 6)
      .flatMap((t) => {
        const safe = t.replace(/[%(),]/g, '');
        return [`title.ilike.%${safe}%`, `description.ilike.%${safe}%`, `city.ilike.%${safe}%`, `category.ilike.%${safe}%`, `venue_name.ilike.%${safe}%`];
      })
      .join(',');
    if (orFilter) query = query.or(orFilter);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.log('[search_events] query error', error);
    return { events: [], query: { keywords, city, from, to } };
  }

  const list = (Array.isArray(rows) ? rows : []) as EventRow[];
  const scored = list
    .map((event) => ({ event, score: scoreEvent(event, keywords, city) }))
    .filter((row) => (keywords.length ? row.score > 0 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.event);

  // If city filter returned nothing useful, retry without city (still published + date)
  if (city && !scored.length && keywords.length) {
    const retry = await supabase
      .from('events')
      .select('id,title,description,city,address,venue_name,category,starts_at,status')
      .eq('status', 'published')
      .gte('starts_at', from ?? new Date().toISOString())
      .or(
        keywords
          .slice(0, 5)
          .flatMap((t) => {
            const safe = t.replace(/[%(),]/g, '');
            return [`title.ilike.%${safe}%`, `description.ilike.%${safe}%`, `city.ilike.%${safe}%`, `venue_name.ilike.%${safe}%`];
          })
          .join(','),
      )
      .limit(40);

    if (!retry.error && Array.isArray(retry.data)) {
      const fallback = (retry.data as EventRow[])
        .map((event) => ({ event, score: scoreEvent(event, keywords, null) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((row) => row.event);
      return { events: fallback, query: { keywords, city, from, to } };
    }
  }

  return { events: scored, query: { keywords, city, from, to } };
}
