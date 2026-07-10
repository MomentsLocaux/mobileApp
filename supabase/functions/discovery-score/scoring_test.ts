import {
  DEFAULT_MAX_RADIUS_KM,
  MIN_DISPLAY_SCORE,
  SCORING_WEIGHTS,
  buildProfileContext,
  haversineKm,
  rankCandidates,
  scoreCandidate,
  type ScoringCandidateEvent,
  type ScoringContext,
} from './scoring.ts';

const baseEvent: ScoringCandidateEvent = {
  event_id: '11111111-1111-1111-1111-111111111111',
  category: 'cat-1',
  subcategory: null,
  tags: ['live'],
  starts_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  latitude: 48.86,
  longitude: 2.33,
  creator_id: 'creator-1',
  distance_km: 5,
};

const baseContext: ScoringContext = {
  userLat: 48.8566,
  userLon: 2.3522,
  isWeekend: false,
  now: new Date(),
  profile: buildProfileContext({
    categoryAffinities: { 'cat-1': 0.8 },
    engagementAffinities: {},
  }),
  mobility: {
    weekdayRadiusKm: 20,
    weekendRadiusKm: 35,
    maxTypicalDistanceKm: 25,
  },
  places: [],
  engagedCreatorIds: new Set(),
  engagedCategoryIds: new Set(['cat-1']),
  recommendationType: 'right_now',
};

Deno.test('weights sum to 1', () => {
  const total = Object.values(SCORING_WEIGHTS).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.0001) {
    throw new Error(`expected weights to sum to 1, got ${total}`);
  }
});

Deno.test('haversineKm returns ~0 for identical points', () => {
  const distance = haversineKm(48.8566, 2.3522, 48.8566, 2.3522);
  if (distance > 0.01) {
    throw new Error(`expected ~0 km, got ${distance}`);
  }
});

Deno.test('scoreCandidate boosts category affinity', () => {
  const highAffinity = scoreCandidate(baseContext, baseEvent);
  const lowAffinity = scoreCandidate(
    {
      ...baseContext,
      profile: buildProfileContext({ categoryAffinities: {}, engagementAffinities: {} }),
    },
    baseEvent,
  );
  if (highAffinity.score <= lowAffinity.score) {
    throw new Error('expected higher score with category affinity');
  }
  if (highAffinity.reasonCodes.includes('category_match') !== true) {
    throw new Error('expected category_match reason code');
  }
});

Deno.test('rankCandidates filters below minimum score', () => {
  const farEvent: ScoringCandidateEvent = {
    ...baseEvent,
    event_id: '22222222-2222-2222-2222-222222222222',
    distance_km: 500,
    category: null,
    tags: [],
  };
  const ranked = rankCandidates(baseContext, [farEvent], 5);
  if (ranked.length !== 0) {
    throw new Error(`expected empty ranking, got ${ranked.length}`);
  }
});

Deno.test('rankCandidates respects limit and ordering', () => {
  const near: ScoringCandidateEvent = { ...baseEvent, event_id: 'a', distance_km: 2 };
  const mid: ScoringCandidateEvent = { ...baseEvent, event_id: 'b', distance_km: 8 };
  const ranked = rankCandidates(baseContext, [mid, near], 1);
  if (ranked.length !== 1) {
    throw new Error(`expected 1 candidate, got ${ranked.length}`);
  }
  if (ranked[0].score < MIN_DISPLAY_SCORE) {
    throw new Error('expected score above minimum display threshold');
  }
});

Deno.test('buildProfileContext falls back to engagement affinities', () => {
  const profile = buildProfileContext({
    categoryAffinities: {},
    engagementAffinities: { 'cat-engaged': 0.66 },
  });
  if (profile.categoryAffinities['cat-engaged'] !== 0.66) {
    throw new Error('expected engagement affinities fallback');
  }
});

Deno.test('cold start affinity default is neutral', () => {
  const profile = buildProfileContext({});
  const scored = scoreCandidate(
    { ...baseContext, profile, engagedCategoryIds: new Set() },
    { ...baseEvent, category: 'unknown-cat' },
  );
  if (scored.score <= 0) {
    throw new Error('expected positive cold-start score');
  }
});
