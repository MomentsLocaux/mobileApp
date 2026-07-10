export const SCORING_WEIGHTS = {
  content: 0.25,
  geo: 0.2,
  time: 0.15,
  mobility: 0.15,
  novelty: 0.15,
  context: 0.1,
} as const;

export const MIN_DISPLAY_SCORE = 0.35;
export const DEFAULT_MAX_RADIUS_KM = 25;
export const RIGHT_NOW_HORIZON_HOURS = 4;
export const FOR_YOU_HORIZON_HOURS = 48;

export type ScoringCandidateEvent = {
  event_id: string;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  starts_at: string;
  latitude: number | null;
  longitude: number | null;
  creator_id: string;
  distance_km: number;
};

export type MobilityContext = {
  weekdayRadiusKm: number | null;
  weekendRadiusKm: number | null;
  maxTypicalDistanceKm: number | null;
};

export type ProfileContext = {
  categoryAffinities: Record<string, number>;
  subcategoryAffinities: Record<string, number>;
  tagAffinities: Record<string, number>;
  noveltyPreference: number;
  typicalWeekdayHours: number[];
  typicalWeekendHours: number[];
};

export type PlaceContext = {
  centroidLatitude: number;
  centroidLongitude: number;
  visitCount: number;
};

export type ScoringContext = {
  userLat: number;
  userLon: number;
  isWeekend: boolean;
  now: Date;
  profile: ProfileContext;
  mobility: MobilityContext;
  places: PlaceContext[];
  engagedCreatorIds: Set<string>;
  engagedCategoryIds: Set<string>;
  recommendationType: 'right_now' | 'for_you' | 'break_the_loop';
};

export type ScoredCandidate = {
  eventId: string;
  score: number;
  reasonCodes: string[];
  distanceKm: number;
};

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseHourWindows(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((hour) => Number.isFinite(hour) && hour >= 0 && hour <= 23);
}

export function buildProfileContext(input: {
  categoryAffinities?: Record<string, number> | null;
  subcategoryAffinities?: Record<string, number> | null;
  tagAffinities?: Record<string, number> | null;
  noveltyPreference?: number | null;
  typicalWeekdayHours?: unknown;
  typicalWeekendHours?: unknown;
  engagementAffinities?: Record<string, number> | null;
}): ProfileContext {
  const stored = input.categoryAffinities ?? {};
  const hasStored = Object.keys(stored).length > 0;
  const categoryAffinities = hasStored ? stored : (input.engagementAffinities ?? {});

  return {
    categoryAffinities,
    subcategoryAffinities: input.subcategoryAffinities ?? {},
    tagAffinities: input.tagAffinities ?? {},
    noveltyPreference: input.noveltyPreference ?? 0.5,
    typicalWeekdayHours: parseHourWindows(input.typicalWeekdayHours),
    typicalWeekendHours: parseHourWindows(input.typicalWeekendHours),
  };
}

function affinityForEvent(profile: ProfileContext, event: ScoringCandidateEvent): number {
  const scores: number[] = [];
  if (event.category && profile.categoryAffinities[event.category] != null) {
    scores.push(profile.categoryAffinities[event.category]);
  }
  if (event.subcategory && profile.subcategoryAffinities[event.subcategory] != null) {
    scores.push(profile.subcategoryAffinities[event.subcategory]);
  }
  for (const tag of event.tags ?? []) {
    if (profile.tagAffinities[tag] != null) {
      scores.push(profile.tagAffinities[tag]);
    }
  }
  if (scores.length === 0) return 0.35;
  return Math.min(1, Math.max(...scores));
}

function timeFit(ctx: ScoringContext, startsAtIso: string): number {
  const startsAt = new Date(startsAtIso);
  const hour = startsAt.getHours();
  const windows = ctx.isWeekend ? ctx.profile.typicalWeekendHours : ctx.profile.typicalWeekdayHours;
  if (windows.length === 0) {
    const hoursUntil = (startsAt.getTime() - ctx.now.getTime()) / 3_600_000;
    if (hoursUntil <= 2) return 0.9;
    if (hoursUntil <= 6) return 0.7;
    return 0.5;
  }
  const nearest = windows.reduce((best, candidate) => {
    const delta = Math.abs(candidate - hour);
    return Math.min(best, Math.min(delta, 24 - delta));
  }, 24);
  return Math.max(0.2, 1 - nearest / 6);
}

function mobilityFit(ctx: ScoringContext, distanceKm: number): number {
  const radius = ctx.isWeekend
    ? (ctx.mobility.weekendRadiusKm ?? ctx.mobility.maxTypicalDistanceKm ?? DEFAULT_MAX_RADIUS_KM)
    : (ctx.mobility.weekdayRadiusKm ?? ctx.mobility.maxTypicalDistanceKm ?? DEFAULT_MAX_RADIUS_KM);
  if (radius <= 0) return 0.5;
  return Math.max(0, 1 - distanceKm / radius);
}

function noveltyForLocation(places: PlaceContext[], lat: number | null, lon: number | null): number {
  if (lat == null || lon == null) return 0.5;
  const nearby = places.filter((place) => haversineKm(place.centroidLatitude, place.centroidLongitude, lat, lon) <= 2);
  if (nearby.length === 0) return 0.85;
  const visits = nearby.reduce((sum, place) => sum + place.visitCount, 0);
  return Math.max(0.15, 1 - Math.min(1, visits / 20));
}

function contextBoost(ctx: ScoringContext, event: ScoringCandidateEvent): number {
  const startsAt = new Date(event.starts_at);
  const minutesUntil = (startsAt.getTime() - ctx.now.getTime()) / 60_000;
  let score = 0.4;
  if (minutesUntil > 0 && minutesUntil <= 90) score = 0.95;
  else if (minutesUntil > 90 && minutesUntil <= 240) score = 0.7;
  if (ctx.recommendationType === 'right_now' && minutesUntil > 240) score *= 0.5;
  return score;
}

export function buildReasonCodes(input: {
  affinity: number;
  geo: number;
  time: number;
  novelty: number;
  context: number;
  distanceKm: number;
  isWeekend: boolean;
  hasPastInterest: boolean;
}): string[] {
  const codes: string[] = [];
  if (input.distanceKm <= 10) codes.push('nearby');
  if (input.affinity >= 0.55) codes.push('category_match');
  if (input.time >= 0.7) codes.push('time_match');
  if (input.novelty >= 0.7) codes.push('new_area');
  if (input.isWeekend && input.geo >= 0.6) codes.push('weekend_fit');
  if (input.context >= 0.85) codes.push('starting_soon');
  if (input.hasPastInterest) codes.push('past_interest');
  return codes;
}

export function scoreCandidate(ctx: ScoringContext, event: ScoringCandidateEvent): ScoredCandidate {
  const distanceKm = event.distance_km;
  const maxKm = ctx.mobility.maxTypicalDistanceKm ?? DEFAULT_MAX_RADIUS_KM;
  const affinity = affinityForEvent(ctx.profile, event);
  const geo = 1 - Math.min(1, distanceKm / Math.max(1, maxKm));
  const time = timeFit(ctx, event.starts_at);
  const mobility = mobilityFit(ctx, distanceKm);
  const novelty = noveltyForLocation(ctx.places, event.latitude, event.longitude);
  const context = contextBoost(ctx, event);

  let score =
    SCORING_WEIGHTS.content * affinity +
    SCORING_WEIGHTS.geo * geo +
    SCORING_WEIGHTS.time * time +
    SCORING_WEIGHTS.mobility * mobility +
    SCORING_WEIGHTS.novelty * novelty +
    SCORING_WEIGHTS.context * context;

  if (ctx.recommendationType === 'break_the_loop') {
    score += SCORING_WEIGHTS.novelty * novelty * 0.35;
    if (novelty >= 0.7) score += 0.08;
  }

  const hasPastInterest =
    (event.category != null && ctx.engagedCategoryIds.has(event.category)) ||
    ctx.engagedCreatorIds.has(event.creator_id);

  return {
    eventId: event.event_id,
    score: Number(score.toFixed(4)),
    reasonCodes: buildReasonCodes({
      affinity,
      geo,
      time,
      novelty,
      context,
      distanceKm,
      isWeekend: ctx.isWeekend,
      hasPastInterest,
    }),
    distanceKm,
  };
}

export function rankCandidates(
  ctx: ScoringContext,
  events: ScoringCandidateEvent[],
  limit: number,
): ScoredCandidate[] {
  return events
    .map((event) => scoreCandidate(ctx, event))
    .filter((candidate) => candidate.score >= MIN_DISPLAY_SCORE)
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
    .slice(0, Math.max(1, limit));
}
