/**
 * SCRUM-156 — Rank nearby published events that could be the same as the
 * current fiche (title overlap + 5 km). No dedicated RPC: callers fetch a
 * bbox via listEvents, then this ranks the rows.
 */

import { tokenizeNameQuery } from './event-name-search';

export const DUPLICATE_CANDIDATE_RADIUS_KM = 5;
export const DUPLICATE_CANDIDATE_LIMIT = 8;
export const DUPLICATE_CANDIDATE_FETCH_LIMIT = 80;

export type DuplicateCandidateSource = {
  id: string;
  title?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type DuplicateCandidateEvent = DuplicateCandidateSource & {
  description?: string | null;
  city?: string | null;
  address?: string | null;
  venue_name?: string | null;
  starts_at?: string | null;
  cover_url?: string | null;
};

export type RankedDuplicateCandidate = DuplicateCandidateEvent & {
  distanceKm: number;
  titleScore: number;
};

const toRad = (value: number) => (value * Math.PI) / 180;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function hasDuplicateSearchOrigin(event: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

/** Longest distinctive token, so listEvents `ilike` stays loose (one token, not AND-all). */
export function distinctiveTitleQuery(title?: string | null): string | undefined {
  const tokens = tokenizeNameQuery(title || '').sort((a, b) => b.length - a.length);
  return tokens.find((token) => token.length >= 4) || tokens[0];
}

export function titleOverlapScore(sourceTitle: string, candidateTitle: string): number {
  const source = tokenizeNameQuery(sourceTitle);
  const candidate = tokenizeNameQuery(candidateTitle);
  if (source.length === 0 || candidate.length === 0) return 0;

  const candidateSet = new Set(candidate);
  const shared = source.filter((token) => candidateSet.has(token));
  if (shared.length === 0) return 0;

  const longest = Math.max(...shared.map((token) => token.length));
  if (shared.length === 1 && longest < 4) return 0;

  return shared.length / source.length + longest / 20;
}

export function rankDuplicateCandidates(
  source: DuplicateCandidateSource,
  events: DuplicateCandidateEvent[],
  options?: { radiusKm?: number; limit?: number },
): RankedDuplicateCandidate[] {
  if (!hasDuplicateSearchOrigin(source)) return [];

  const originLat = Number(source.latitude);
  const originLng = Number(source.longitude);
  const radiusKm = options?.radiusKm ?? DUPLICATE_CANDIDATE_RADIUS_KM;
  const limit = options?.limit ?? DUPLICATE_CANDIDATE_LIMIT;

  return events
    .filter((event) => event.id && event.id !== source.id)
    .map((event) => {
      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        return null;
      }
      const distanceKm = haversineKm(originLat, originLng, lat, lng);
      if (distanceKm > radiusKm) return null;
      const titleScore = titleOverlapScore(source.title || '', event.title || '');
      if (titleScore <= 0) return null;
      return { ...event, distanceKm, titleScore };
    })
    .filter((item): item is RankedDuplicateCandidate => item != null)
    .sort((a, b) => b.titleScore - a.titleScore || a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
