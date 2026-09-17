import { DISCOVERY_DEFAULT_RADIUS_KM } from '../constants/filters';
import type { EventWithCreator } from '../types/database';
import { extractEventCoords, type EventCoords } from './event-coords';
import {
  getVisibleEventTags,
  type EventTagTaxonomyLookup,
} from './event-card-display';
import { calculateDistanceKm } from './sort-events';

export const SIMILAR_EVENTS_RADIUS_KM = DISCOVERY_DEFAULT_RADIUS_KM;
export const SIMILAR_EVENTS_LIMIT = 3;
export const SIMILAR_EVENTS_FETCH_LIMIT = 80;

const pickCategoryMetaSlug = (categoryMetaValue: unknown): string | null => {
  if (Array.isArray(categoryMetaValue)) {
    const slug = (categoryMetaValue[0] as { slug?: string } | undefined)?.slug;
    return typeof slug === 'string' ? slug : null;
  }
  if (categoryMetaValue && typeof categoryMetaValue === 'object') {
    const slug = (categoryMetaValue as { slug?: string }).slug;
    return typeof slug === 'string' ? slug : null;
  }
  return null;
};

export function resolveEventCategoryKey(
  event: Pick<EventWithCreator, 'category' | 'category_meta'>,
): string | null {
  const slug = pickCategoryMetaSlug(event.category_meta)?.trim().toLowerCase();
  if (slug) return slug;
  const raw = event.category?.trim();
  return raw ? raw.toLowerCase() : null;
}

const temporalRank = (event: Pick<EventWithCreator, 'starts_at' | 'ends_at'>, now: Date): number => {
  const nowMs = now.getTime();
  const startMs = event.starts_at ? new Date(event.starts_at).getTime() : NaN;
  const endMs = event.ends_at ? new Date(event.ends_at).getTime() : NaN;
  if (!Number.isNaN(endMs) && endMs < nowMs) return 2;
  if (!Number.isNaN(startMs) && startMs <= nowMs && (Number.isNaN(endMs) || endMs >= nowMs)) return 0;
  if (!Number.isNaN(startMs) && startMs > nowMs) return 1;
  return 1;
};

const tagOverlapCount = (sourceTags: Set<string>, candidateTags: string[]): number => {
  let overlap = 0;
  for (const tag of candidateTags) {
    if (sourceTags.has(tag)) overlap += 1;
  }
  return overlap;
};

type PickSimilarEventsParams = {
  source: EventWithCreator;
  candidates: EventWithCreator[];
  origin: EventCoords;
  radiusKm?: number;
  limit?: number;
  now?: Date;
  taxonomy?: EventTagTaxonomyLookup;
};

export function normalizeEventTitle(title?: string | null): string {
  return (title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Similarity: same category, plus at least one visible tag when the source has tags.
 * Otherwise same category only. Ranked by tag overlap, then live/upcoming, then distance.
 */
export function pickSimilarEvents({
  source,
  candidates,
  origin,
  radiusKm = SIMILAR_EVENTS_RADIUS_KM,
  limit = SIMILAR_EVENTS_LIMIT,
  now = new Date(),
  taxonomy,
}: PickSimilarEventsParams): EventWithCreator[] {
  const categoryKey = resolveEventCategoryKey(source);
  if (!categoryKey || limit <= 0) return [];

  const sourceTags = getVisibleEventTags(source.tags, taxonomy).map((tag) => tag.toLowerCase());
  const sourceTagSet = new Set(sourceTags);
  const requireTagOverlap = sourceTagSet.size > 0;
  const sourceTitle = normalizeEventTitle(source.title);

  const ranked = candidates.flatMap((candidate) => {
    if (!candidate?.id || candidate.id === source.id) return [];
    if (sourceTitle && normalizeEventTitle(candidate.title) === sourceTitle) return [];
    if (resolveEventCategoryKey(candidate) !== categoryKey) return [];

    const coords = extractEventCoords(candidate);
    if (!coords) return [];

    const distanceKm = calculateDistanceKm(
      origin.latitude,
      origin.longitude,
      coords.latitude,
      coords.longitude,
    );
    if (distanceKm > radiusKm) return [];

    const candidateTags = getVisibleEventTags(candidate.tags, taxonomy).map((tag) => tag.toLowerCase());
    const overlap = requireTagOverlap ? tagOverlapCount(sourceTagSet, candidateTags) : 0;
    if (requireTagOverlap && overlap === 0) return [];

    return [
      {
        event: candidate,
        overlap,
        distanceKm,
        temporal: temporalRank(candidate, now),
        startsAt: candidate.starts_at ? new Date(candidate.starts_at).getTime() : Number.POSITIVE_INFINITY,
      },
    ];
  });

  ranked.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (a.temporal !== b.temporal) return a.temporal - b.temporal;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.startsAt - b.startsAt;
  });

  return ranked.slice(0, limit).map((item) => item.event);
}
