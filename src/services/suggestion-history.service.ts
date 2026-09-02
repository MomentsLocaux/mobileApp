import { supabase } from '@/lib/supabase/client';
import {
  bugToHistoryItem,
  correctionToHistoryItem,
  eventSuggestToHistoryItem,
  isSuggestionHistoryCacheFresh,
  mergeSuggestionHistory,
  type SuggestionBugInput,
  type SuggestionCorrectionInput,
  type SuggestionEventInput,
  type SuggestionHistoryItem,
} from '@/utils/suggestion-history';

const HISTORY_LIMIT = 50;

const EVENT_SELECT =
  'id, title, status, city, address, refusal_reason, created_at, submission_source';
const CORRECTION_SELECT =
  'id, kind, comment, status, review_note, created_at, event_id, duplicate_hint';
const BUG_SELECT = 'id, category, description, page, status, created_at';

export type SuggestionHistoryResult = {
  items: SuggestionHistoryItem[];
  failed: boolean;
};

type CacheEntry = SuggestionHistoryResult & {
  userId: string;
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
let inflight: { userId: string; promise: Promise<SuggestionHistoryResult> } | null = null;

export function peekMySuggestionHistory(userId: string): SuggestionHistoryResult | null {
  if (cache?.userId !== userId) return null;
  return { items: cache.items, failed: cache.failed };
}

export function invalidateMySuggestionHistory(userId?: string) {
  if (!userId || cache?.userId === userId) {
    cache = null;
  }
}

export function prefetchMySuggestionHistory(userId: string) {
  void loadMySuggestionHistory(userId);
}

async function fetchSuggestedEvents(userId: string): Promise<SuggestionEventInput[]> {
  const { data, error } = await (supabase.from('events') as any)
    .select(EVENT_SELECT)
    .eq('creator_id', userId)
    .eq('submission_source', 'community_suggest')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data || []) as SuggestionEventInput[];
}

async function fetchMyCorrections(userId: string): Promise<SuggestionCorrectionInput[]> {
  const { data, error } = await (supabase.from('event_correction_proposals') as any)
    .select(CORRECTION_SELECT)
    .eq('proposer_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data || []) as SuggestionCorrectionInput[];
}

async function fetchMyBugs(userId: string): Promise<SuggestionBugInput[]> {
  const { data, error } = await (supabase.from('bug_reports') as any)
    .select(BUG_SELECT)
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data || []) as SuggestionBugInput[];
}

async function fetchMySuggestionHistory(userId: string): Promise<SuggestionHistoryResult> {
  const results = await Promise.allSettled([
    fetchSuggestedEvents(userId),
    fetchMyCorrections(userId),
    fetchMyBugs(userId),
  ]);

  const failed = results.some((result) => result.status === 'rejected');
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn('loadMySuggestionHistory', index, result.reason);
    }
  });

  const events = results[0].status === 'fulfilled' ? results[0].value : [];
  const corrections = results[1].status === 'fulfilled' ? results[1].value : [];
  const bugs = results[2].status === 'fulfilled' ? results[2].value : [];

  return {
    failed,
    items: mergeSuggestionHistory([
      ...events.map(eventSuggestToHistoryItem),
      ...corrections.map(correctionToHistoryItem),
      ...bugs.map(bugToHistoryItem),
    ]),
  };
}

export async function loadMySuggestionHistory(
  userId: string,
  options?: { force?: boolean },
): Promise<SuggestionHistoryResult> {
  if (
    !options?.force &&
    cache?.userId === userId &&
    isSuggestionHistoryCacheFresh(cache.fetchedAt)
  ) {
    return { items: cache.items, failed: cache.failed };
  }

  if (inflight?.userId === userId) {
    return inflight.promise;
  }

  const promise = (async () => {
    try {
      const result = await fetchMySuggestionHistory(userId);
      cache = { userId, fetchedAt: Date.now(), ...result };
      return result;
    } finally {
      if (inflight?.userId === userId) inflight = null;
    }
  })();

  inflight = { userId, promise };
  return promise;
}
