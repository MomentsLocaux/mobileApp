import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  DEFAULT_MAX_RADIUS_KM,
  FOR_YOU_HORIZON_HOURS,
  RIGHT_NOW_HORIZON_HOURS,
  buildProfileContext,
  rankCandidates,
  type ScoringCandidateEvent,
  type ScoringContext,
} from './scoring.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ScoreRequest = {
  latitude?: number;
  longitude?: number;
  types?: Array<'right_now' | 'for_you'>;
  limit?: number;
};

type PersistedRecommendation = {
  user_id: string;
  event_id: string;
  recommendation_type: 'right_now' | 'for_you';
  score: number;
  reason_codes: string[];
  context: Record<string, unknown>;
  valid_until: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function parseCoordinates(body: ScoreRequest): { lat: number; lon: number } | null {
  if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
    return { lat: body.latitude, lon: body.longitude };
  }
  return null;
}

async function resolveCoordinates(
  admin: SupabaseClient,
  userId: string,
  body: ScoreRequest,
): Promise<{ lat: number; lon: number } | null> {
  const direct = parseCoordinates(body);
  if (direct) return direct;

  const { data, error } = await admin.rpc('get_home_location_coords', { p_user_id: userId });
  if (error) {
    console.warn('[discovery-score] home location unavailable', error.message);
    return null;
  }
  if (data && typeof data === 'object' && data !== null) {
    const record = data as { lat?: number; lon?: number };
    if (typeof record.lat === 'number' && typeof record.lon === 'number') {
      return { lat: record.lat, lon: record.lon };
    }
  }
  return null;
}

async function isPremiumActive(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('user_subscriptions')
    .select('status, expires_at')
    .eq('user_id', userId)
    .eq('entitlement', 'moments_locaux_plus')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  const activeStatuses = new Set(['active', 'grace_period', 'trialing']);
  if (!activeStatuses.has(data.status)) return false;
  if (!data.expires_at) return true;
  return new Date(data.expires_at).getTime() > Date.now();
}

async function countRightNowToday(admin: SupabaseClient, userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from('event_recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('recommendation_type', 'right_now')
    .gte('generated_at', startOfDay.toISOString());

  if (error) {
    console.warn('[discovery-score] right_now count failed', error.message);
    return 0;
  }
  return count ?? 0;
}

async function loadEngagedSets(
  admin: SupabaseClient,
  userId: string,
): Promise<{ creatorIds: Set<string>; categoryIds: Set<string> }> {
  const creatorIds = new Set<string>();
  const categoryIds = new Set<string>();

  const [likes, interests, favorites] = await Promise.all([
    admin.from('event_likes').select('event_id').eq('user_id', userId).limit(200),
    admin.from('event_interests').select('event_id').eq('user_id', userId).limit(200),
    admin.from('favorites').select('event_id').eq('profile_id', userId).limit(200),
  ]);

  const eventIds = new Set<string>();
  for (const row of likes.data ?? []) eventIds.add(row.event_id);
  for (const row of interests.data ?? []) eventIds.add(row.event_id);
  for (const row of favorites.data ?? []) eventIds.add(row.event_id);

  if (eventIds.size === 0) {
    return { creatorIds, categoryIds };
  }

  const { data: events } = await admin
    .from('events')
    .select('id, creator_id, category')
    .in('id', Array.from(eventIds));

  for (const event of events ?? []) {
    creatorIds.add(event.creator_id);
    if (event.category) categoryIds.add(event.category);
  }

  return { creatorIds, categoryIds };
}

async function fetchCandidates(
  userClient: SupabaseClient,
  lat: number,
  lon: number,
  radiusKm: number,
  horizonHours: number,
): Promise<ScoringCandidateEvent[]> {
  const { data, error } = await userClient.rpc('get_discovery_scoring_candidates', {
    p_lat: lat,
    p_lon: lon,
    p_radius_km: radiusKm,
    p_horizon_hours: horizonHours,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as ScoringCandidateEvent[];
}

async function persistRecommendations(
  admin: SupabaseClient,
  userId: string,
  rows: PersistedRecommendation[],
): Promise<string[]> {
  if (rows.length === 0) return [];

  const { data, error } = await admin
    .from('event_recommendations')
    .insert(rows)
    .select('id');

  if (error) throw new Error(error.message);

  const recommendationIds = (data ?? []).map((row) => row.id as string);
  if (recommendationIds.length === 0) return [];

  const events = recommendationIds.map((recommendationId) => ({
    recommendation_id: recommendationId,
    user_id: userId,
    event_type: 'generated',
    metadata: { source: 'discovery-score-v1' },
  }));

  const { error: funnelError } = await admin.from('recommendation_events').insert(events);
  if (funnelError) throw new Error(funnelError.message);

  return recommendationIds;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'method_not_allowed' }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, message: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return json({ success: false, message: 'authentication_required' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ success: false, message: 'invalid_user' }, 401);
  }

  const userId = userData.user.id;

  let body: ScoreRequest = {};
  try {
    body = (await req.json()) as ScoreRequest;
  } catch {
    body = {};
  }

  const coords = await resolveCoordinates(admin, userId, body);
  if (!coords) {
    return json({
      success: false,
      message: 'location_required',
      hint: 'Provide latitude/longitude or set home_location via user preferences.',
    }, 422);
  }

  const types = body.types?.length ? body.types : (['right_now', 'for_you'] as const);
  const premium = await isPremiumActive(admin, userId);
  const rightNowToday = await countRightNowToday(admin, userId);

  const [
    profileRow,
    mobilityRow,
    placesRows,
    engagementAffinities,
    engagedSets,
  ] = await Promise.all([
    admin.from('discovery_profiles').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('mobility_profiles').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('discovery_places').select('centroid_latitude, centroid_longitude, visit_count').eq('user_id', userId).limit(100),
    userClient.rpc('get_discovery_engagement_affinities', { p_user_id: userId }),
    loadEngagedSets(admin, userId),
  ]);

  const profile = buildProfileContext({
    categoryAffinities: (profileRow.data?.category_affinities ?? null) as Record<string, number> | null,
    subcategoryAffinities: (profileRow.data?.subcategory_affinities ?? null) as Record<string, number> | null,
    tagAffinities: (profileRow.data?.tag_affinities ?? null) as Record<string, number> | null,
    noveltyPreference: profileRow.data?.novelty_preference ?? null,
    typicalWeekdayHours: profileRow.data?.typical_weekday_hours,
    typicalWeekendHours: profileRow.data?.typical_weekend_hours,
    engagementAffinities: (engagementAffinities.data ?? null) as Record<string, number> | null,
  });

  const mobility = {
    weekdayRadiusKm: mobilityRow.data?.weekday_radius_km ?? null,
    weekendRadiusKm: mobilityRow.data?.weekend_radius_km ?? null,
    maxTypicalDistanceKm: mobilityRow.data?.max_typical_distance_km ?? DEFAULT_MAX_RADIUS_KM,
  };

  const radiusKm = mobility.maxTypicalDistanceKm ?? DEFAULT_MAX_RADIUS_KM;
  const now = new Date();
  const persisted: PersistedRecommendation[] = [];
  const summary: Record<string, { generated: number; topScore: number | null }> = {};

  for (const recommendationType of types) {
    const horizonHours = recommendationType === 'right_now'
      ? RIGHT_NOW_HORIZON_HOURS
      : FOR_YOU_HORIZON_HOURS;

    let limit = recommendationType === 'right_now' ? 3 : 10;
    if (!premium) {
      limit = recommendationType === 'right_now' ? 1 : 10;
      if (recommendationType === 'right_now' && rightNowToday >= 1) {
        summary[recommendationType] = { generated: 0, topScore: null };
        continue;
      }
    } else if (typeof body.limit === 'number') {
      limit = Math.max(1, Math.min(body.limit, 20));
    }

    const candidates = await fetchCandidates(userClient, coords.lat, coords.lon, radiusKm, horizonHours);
    const soonFiltered = recommendationType === 'right_now'
      ? candidates.filter((event) => {
        const startsAt = new Date(event.starts_at).getTime();
        return startsAt > now.getTime() && startsAt <= now.getTime() + RIGHT_NOW_HORIZON_HOURS * 3_600_000;
      })
      : candidates;

    const ctx: ScoringContext = {
      userLat: coords.lat,
      userLon: coords.lon,
      isWeekend: isWeekend(now),
      now,
      profile,
      mobility,
      places: (placesRows.data ?? []).map((place) => ({
        centroidLatitude: place.centroid_latitude,
        centroidLongitude: place.centroid_longitude,
        visitCount: place.visit_count,
      })),
      engagedCreatorIds: engagedSets.creatorIds,
      engagedCategoryIds: engagedSets.categoryIds,
      recommendationType,
    };

    const ranked = rankCandidates(ctx, soonFiltered, limit);
    const validHours = recommendationType === 'right_now' ? 4 : 24;

    for (const candidate of ranked) {
      persisted.push({
        user_id: userId,
        event_id: candidate.eventId,
        recommendation_type: recommendationType,
        score: candidate.score,
        reason_codes: candidate.reasonCodes,
        context: {
          distance_km: candidate.distanceKm,
          source: 'discovery-score-v1',
          premium,
        },
        valid_until: new Date(now.getTime() + validHours * 3_600_000).toISOString(),
      });
    }

    summary[recommendationType] = {
      generated: ranked.length,
      topScore: ranked[0]?.score ?? null,
    };
  }

  const recommendationIds = await persistRecommendations(admin, userId, persisted);

  return json({
    success: true,
    user_id: userId,
    premium,
    coordinates: coords,
    generated_count: recommendationIds.length,
    summary,
    recommendation_ids: recommendationIds,
  });
});
